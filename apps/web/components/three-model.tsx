"use client";

import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Code } from "lucide-react";
import { useTheme } from "next-themes";

// Meshopt-compressed (about 95 KB over the network instead of 670 KB). The
// file name changes whenever the model changes, so it can be cached for a year.
const MODEL_URL = "/models/FirstByteBitex4.meshopt.glb";

interface ThreeModelProps {
  isMobile?: boolean; // Make prop optional for now
}

export function ThreeModel({ isMobile = false }: ThreeModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  // resolvedTheme, not theme: in system mode `theme` is the string "system",
  // which matches neither "light" nor "dark".
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  // Create refs to store scene elements
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight | null;
    directional: THREE.DirectionalLight | null;
    fillLight: THREE.DirectionalLight | null;
    backLight: THREE.DirectionalLight | null;
    darkModeFillLight: THREE.DirectionalLight | null;
  }>({
    ambient: null,
    directional: null,
    fillLight: null,
    backLight: null,
    darkModeFillLight: null,
  });
  const modelRef = useRef<THREE.Group | null>(null);

  // Add keyframe animations at the beginning of the component
  useEffect(() => {
    // Add keyframe animations if they don't exist yet
    if (!document.querySelector("#model-animations")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "model-animations";
      styleSheet.textContent = `
        @keyframes shimmer {
          0% { background-position: -500px 0; }
          100% { background-position: 500px 0; }
        }
        @keyframes glow {
          0% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.5); }
          50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.8), 0 0 30px rgba(16, 185, 129, 0.6); }
          100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.5); }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateX(10px) translateY(-50%); }
          100% { opacity: 1; transform: translateX(0) translateY(-50%); }
        }
        @keyframes fade-out {
          0% { opacity: 1; transform: translateX(0) translateY(-50%); }
          100% { opacity: 0; transform: translateX(-10px) translateY(-50%); }
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-shimmer {
          background-size: 1000px 100%;
          background-image: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
          animation: shimmer 8s infinite linear;
        }
        .animate-glow {
          animation: glow 3s infinite ease-in-out;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite ease-in-out;
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        .animate-fade-out {
          animation: fade-out 0.8s ease-out forwards;
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s infinite ease-in-out;
        }
        .clip-corner {
          clip-path: polygon(0 0, 100% 0, 100% 100%);
        }
      `;
      document.head.appendChild(styleSheet);
    }

    if (!containerRef.current) return;

    // Initialize Three.js components
    const container = containerRef.current;
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 50.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    // Phones often have 3x screens; drawing every pixel at 3x is heavy and
    // looks the same as 2x on a model this size.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Update renderer based on theme
    updateRendererForTheme(renderer);

    // Create lights
    setupLights(scene);

    // Add controls
    const controls = new ThreeOrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = Math.PI / 1.5;

    // Add a simple cube as a placeholder while loading
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: isDarkMode ? 0.2 : 0.5,
      metalness: 0.7,
      roughness: 0.3,
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Handle for whichever render loop is currently running. Both the
    // placeholder-cube loop and the post-load model loop write here, so there is
    // always exactly one scheduled frame to cancel -- on unmount, and when the
    // model arrives and supersedes the cube.
    let frameId: number | null = null;
    // The GLTF load is async and can resolve after unmount. Without this guard
    // its callback would start a fresh loop against a disposed renderer.
    let disposed = false;

    let tick: (() => void) | null = null;
    let onScreen = true;

    const start = (fn: (() => void) | null) => {
      if (!fn || disposed) return;
      tick = fn;
      // Off-screen or backgrounded: remember the loop, let sync() resume it
      if (!onScreen || document.hidden) return;
      if (frameId === null) frameId = requestAnimationFrame(fn);
    };

    const pause = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    // Render only while the hero is visible and the tab is focused
    const sync = () => (onScreen && !document.hidden ? start(tick) : pause());

    // Animate the cube
    const animateCube = () => {
      frameId = requestAnimationFrame(animateCube);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    start(animateCube);

    // Load the model with improved visibility settings
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    try {
      loader.load(
        MODEL_URL,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;
          modelRef.current = model;

          // Remove placeholder cube, and stop the loop that was driving it.
          // The model loop started below takes over rendering from here; without
          // this cancel both loops would render every frame for the life of the
          // page.
          pause();
          scene.remove(cube);
          geometry.dispose();
          material.dispose();

          // Make model smaller and adjust position
          const scale = isMobile ? 0.25 : 0.2; // Slightly larger on mobile
          model.scale.set(scale, scale, scale);
          model.position.set(0, -0.1, 0); // Slight offset to center

          // Set initial rotation to the preferred orientation
          const initialRotationY = -1.29; // -56.56 degrees
          const initialRotationX = 0.315; // 6.59 degrees
          model.rotation.y = initialRotationY;
          model.rotation.x = initialRotationX;

          // Add to scene
          scene.add(model);

          // Adjust material properties based on theme
          updateModelMaterials(model);

          // Adjust camera to better frame the model
          camera.position.set(0, 0, 30);
          camera.lookAt(0, 0, 0);

          // Mark as loaded
          setIsLoaded(true);

          // Initialize rotation tracking
          let targetRotationY = initialRotationY;
          let currentRotationY = initialRotationY;
          let targetRotationX = initialRotationX;
          let currentRotationX = initialRotationX;
          let rotationOffset = { x: 0, y: 0 };
          const rotationStart = { x: 0, y: 0 };

          // Track original position
          const originalPosition = { x: 0, y: -0.1, z: 0 };
          let targetPosition = { ...originalPosition };
          const currentPosition = { ...originalPosition };

          // Improved floating animation without rotation
          let time = 0;
          const amplitude = 0.04; // Reduced floating height
          const speed = 0.0015; // Slowed down for a gentler float

          // Animation loop
          const animate = () => {
            frameId = requestAnimationFrame(animate);

            // Gentle floating animation with slight horizontal movement
            time += 0.03;
            const floatOffsetY = Math.sin(time * speed) * amplitude;
            const floatOffsetX = Math.sin(time * speed * 0.5) * 0.015;

            // Smoothly interpolate position back to original (with floating effect)
            currentPosition.x +=
              (targetPosition.x + floatOffsetX - currentPosition.x) * 0.1;
            currentPosition.y +=
              (targetPosition.y + floatOffsetY - currentPosition.y) * 0.1;
            currentPosition.z += (targetPosition.z - currentPosition.z) * 0.1;

            model.position.set(
              currentPosition.x,
              currentPosition.y,
              currentPosition.z,
            );

            // Smoothly return to target rotation with stronger spring factor
            currentRotationY += (targetRotationY - currentRotationY) * 0.2;
            currentRotationX += (targetRotationX - currentRotationX) * 0.2;
            model.rotation.y = currentRotationY;
            model.rotation.x = currentRotationX;

            controls.update();
            renderer.render(scene, camera);
          };

          start(animate);

          // Set up mouse interaction
          let isDragging = false;

          container.addEventListener("mousedown", (e) => {
            isDragging = true;
            rotationStart.x = e.clientX;
            rotationStart.y = e.clientY;

            // Add fade-out animation instead of immediately hiding
            const promptElement = document.querySelector(".prompt-message");
            if (promptElement && showPrompt) {
              promptElement.classList.remove("animate-fade-in");
              promptElement.classList.add("animate-fade-out");
              // Wait for animation to complete before hiding
              setTimeout(() => setShowPrompt(false), 700);
            }
          });

          container.addEventListener("touchstart", (e) => {
            isDragging = true;
            rotationStart.x = e.touches[0].clientX;
            rotationStart.y = e.touches[0].clientY;

            // Add fade-out animation instead of immediately hiding
            const promptElement = document.querySelector(".prompt-message");
            if (promptElement && showPrompt) {
              promptElement.classList.remove("animate-fade-in");
              promptElement.classList.add("animate-fade-out");
              // Wait for animation to complete before hiding
              setTimeout(() => setShowPrompt(false), 700);
            }
          });

          container.addEventListener("mousemove", (e) => {
            if (!isDragging) return;

            // Calculate rotation based on the horizontal and vertical drag distance
            const dragDistanceX = e.clientX - rotationStart.x;
            const dragDistanceY = e.clientY - rotationStart.y;

            // Adjust sensitivity (horizontal is more sensitive than vertical)
            rotationOffset.y = dragDistanceX * 0.01;
            rotationOffset.x = dragDistanceY * 0.005;

            // Set target rotation relative to initial position plus the drag offset
            targetRotationY = initialRotationY + rotationOffset.y;
            targetRotationX = initialRotationX - rotationOffset.x; // Invert Y for natural feel

            // Limit vertical rotation to avoid flipping
            targetRotationX = Math.max(
              Math.min(targetRotationX, Math.PI / 4),
              -Math.PI / 4,
            );

            // Update model rotation
            model.rotation.y = targetRotationY;
            model.rotation.x = targetRotationX;

            // Calculate position offset based on viewport center
            const centerX = container.clientWidth / 2;
            const centerY = container.clientHeight / 2;
            targetPosition.x =
              originalPosition.x + (e.clientX - centerX) * 0.0005;
            targetPosition.y =
              originalPosition.y - (e.clientY - centerY) * 0.0005;
          });

          container.addEventListener("touchmove", (e) => {
            if (!isDragging) return;

            // Calculate rotation based on horizontal and vertical drag distance
            const dragDistanceX = e.touches[0].clientX - rotationStart.x;
            const dragDistanceY = e.touches[0].clientY - rotationStart.y;

            // Adjust sensitivity (horizontal is more sensitive than vertical)
            rotationOffset.y = dragDistanceX * 0.01;
            rotationOffset.x = dragDistanceY * 0.005;

            // Set target rotation relative to initial position plus the drag offset
            targetRotationY = initialRotationY + rotationOffset.y;
            targetRotationX = initialRotationX - rotationOffset.x; // Invert Y for natural feel

            // Limit vertical rotation to avoid flipping
            targetRotationX = Math.max(
              Math.min(targetRotationX, Math.PI / 4),
              -Math.PI / 4,
            );

            // Update model rotation
            model.rotation.y = targetRotationY;
            model.rotation.x = targetRotationX;

            // Calculate position offset based on viewport center
            const centerX = container.clientWidth / 2;
            const centerY = container.clientHeight / 2;
            targetPosition.x =
              originalPosition.x + (e.touches[0].clientX - centerX) * 0.0005;
            targetPosition.y =
              originalPosition.y - (e.touches[0].clientY - centerY) * 0.0005;
          });

          window.addEventListener("mouseup", () => {
            if (!isDragging) return;
            isDragging = false;

            // Spring back to original position and rotation
            targetRotationY = initialRotationY;
            targetRotationX = initialRotationX;
            targetPosition = { ...originalPosition };
            rotationOffset = { x: 0, y: 0 };
          });

          window.addEventListener("touchend", () => {
            if (!isDragging) return;
            isDragging = false;

            // Spring back to original position and rotation
            targetRotationY = initialRotationY;
            targetRotationX = initialRotationX;
            targetPosition = { ...originalPosition };
            rotationOffset = { x: 0, y: 0 };
          });
        },
        undefined,
        (error) => {
          console.error("An error happened", error);
          setHasError(true);
        },
      );
    } catch (err) {
      console.error("Failed to load model:", err);
      setHasError(true);
    }

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;

      camera.aspect =
        containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight,
      );
    };

    window.addEventListener("resize", handleResize);
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(container);
    document.addEventListener("visibilitychange", sync);

    // Cleanup
    return () => {
      disposed = true;
      // Without this the render loop outlives the component and keeps drawing
      // into a disposed renderer on every frame.
      if (frameId !== null) cancelAnimationFrame(frameId);

      window.removeEventListener("resize", handleResize);

      // Check if container still has the renderer's DOM element before removing
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      controls.dispose();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Main initialization runs once

  // Function to update renderer settings based on theme
  const updateRendererForTheme = (renderer: THREE.WebGLRenderer) => {
    if (!isDarkMode) {
      renderer.setClearColor(0xf5f5f5, 0.05); // Reduced opacity in light mode
    } else {
      renderer.setClearColor(0x000000, 0); // Completely transparent in dark mode
    }
  };

  // Function to set up lights based on theme
  const setupLights = (scene: THREE.Scene) => {
    // Clear existing lights
    if (lightsRef.current.ambient) scene.remove(lightsRef.current.ambient);
    if (lightsRef.current.directional)
      scene.remove(lightsRef.current.directional);
    if (lightsRef.current.fillLight) scene.remove(lightsRef.current.fillLight);
    if (lightsRef.current.backLight) scene.remove(lightsRef.current.backLight);
    if (lightsRef.current.darkModeFillLight)
      scene.remove(lightsRef.current.darkModeFillLight);

    // Create new lights based on theme
    const ambientLightIntensity = isDarkMode ? 0.4 : 0.9; // Reduced from 1.2 to 0.9
    const directionalLightIntensity = isDarkMode ? 0.8 : 1.0; // Reduced from 1.5 to 1.0

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      ambientLightIntensity,
    );
    scene.add(ambientLight);
    lightsRef.current.ambient = ambientLight;

    // Position the main light source at top left for both modes
    const directionalLight = new THREE.DirectionalLight(
      0xffffff,
      directionalLightIntensity,
    );
    directionalLight.position.set(-5, 5, 3); // Changed to top left
    scene.add(directionalLight);
    lightsRef.current.directional = directionalLight;

    // Add additional lights based on theme
    if (!isDarkMode) {
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.7); // Reduced from 1.0 to 0.7
      fillLight.position.set(5, 3, 5); // Secondary light from opposite direction
      scene.add(fillLight);
      lightsRef.current.fillLight = fillLight;

      const backLight = new THREE.DirectionalLight(0xffffff, 0.5); // Reduced from 0.8 to 0.5
      backLight.position.set(0, 2, -5);
      scene.add(backLight);
      lightsRef.current.backLight = backLight;

      // Remove dark mode fill light if it exists
      if (lightsRef.current.darkModeFillLight) {
        scene.remove(lightsRef.current.darkModeFillLight);
        lightsRef.current.darkModeFillLight = null;
      }
    } else {
      // Add a very subtle fill light for dark mode
      const darkModeFillLight = new THREE.DirectionalLight(0xffffff, 0.3);
      darkModeFillLight.position.set(3, 0, 5);
      scene.add(darkModeFillLight);
      lightsRef.current.darkModeFillLight = darkModeFillLight;

      // Remove light mode lights if they exist
      if (lightsRef.current.fillLight) {
        scene.remove(lightsRef.current.fillLight);
        lightsRef.current.fillLight = null;
      }
      if (lightsRef.current.backLight) {
        scene.remove(lightsRef.current.backLight);
        lightsRef.current.backLight = null;
      }
    }
  };

  // Function to update model materials based on theme
  const updateModelMaterials = (model: THREE.Group) => {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        // Adjust material based on theme
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            // Store original color if not already stored
            if (!material.userData.originalColor && material.color) {
              material.userData.originalColor = material.color.clone();
            }

            // Reset to original color before applying theme adjustments
            if (material.userData.originalColor) {
              material.color.copy(material.userData.originalColor);
            }

            // Apply theme-specific adjustments
            if (!isDarkMode) {
              // Apply brighter colors in light mode
              if (material.color) {
                const color = material.color.clone();
                // Significantly brighten dark colors in light mode
                const luminance =
                  0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
                if (luminance < 0.3) {
                  // For dark materials, brighten them significantly
                  material.color.setRGB(
                    Math.min(color.r * 2.0, 1),
                    Math.min(color.g * 2.0, 1),
                    Math.min(color.b * 2.0, 1),
                  );
                } else {
                  // For already light materials, brighten slightly
                  material.color.setRGB(
                    Math.min(color.r * 1.1, 1),
                    Math.min(color.g * 1.1, 1),
                    Math.min(color.b * 1.1, 1),
                  );
                }
              }

              // Ensure emissive contributes in light mode
              if (material.emissive) {
                if (material.emissiveIntensity !== undefined) {
                  material.emissiveIntensity = 0.05;
                }
              }
            } else {
              // Darken materials slightly in dark mode
              if (material.color) {
                const color = material.color.clone();
                material.color.setRGB(
                  Math.max(color.r * 0.9, 0),
                  Math.max(color.g * 0.9, 0),
                  Math.max(color.b * 0.9, 0),
                );
              }

              // Reduce emissive in dark mode if it exists
              if (material.emissive) {
                if (material.emissiveIntensity !== undefined) {
                  material.emissiveIntensity = 0.05;
                }
              }
            }

            // Adjust material properties for theme
            if (material.metalness !== undefined) {
              material.metalness = isDarkMode ? 0.6 : 0.4;
            }
            if (material.roughness !== undefined) {
              material.roughness = isDarkMode ? 0.4 : 0.45;
            }
          });
        } else if (object.material) {
          // Single material
          // Store original color if not already stored
          if (
            !object.material.userData.originalColor &&
            object.material.color
          ) {
            object.material.userData.originalColor =
              object.material.color.clone();
          }

          // Reset to original color before applying theme adjustments
          if (object.material.userData.originalColor) {
            object.material.color.copy(object.material.userData.originalColor);
          }

          if (!isDarkMode) {
            if (object.material.color) {
              const color = object.material.color.clone();
              // Significantly brighten dark colors in light mode
              const luminance =
                0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
              if (luminance < 0.3) {
                // For dark materials, brighten them significantly
                object.material.color.setRGB(
                  Math.min(color.r * 2.0, 1),
                  Math.min(color.g * 2.0, 1),
                  Math.min(color.b * 2.0, 1),
                );
              } else {
                // For already light materials, brighten slightly
                object.material.color.setRGB(
                  Math.min(color.r * 1.1, 1),
                  Math.min(color.g * 1.1, 1),
                  Math.min(color.b * 1.1, 1),
                );
              }
            }

            // Ensure emissive contributes in light mode
            if (object.material.emissive) {
              if (object.material.emissiveIntensity !== undefined) {
                object.material.emissiveIntensity = 0.05;
              }
            }
          } else {
            // Darken materials slightly in dark mode
            if (object.material.color) {
              const color = object.material.color.clone();
              object.material.color.setRGB(
                Math.max(color.r * 0.9, 0),
                Math.max(color.g * 0.9, 0),
                Math.max(color.b * 0.9, 0),
              );
            }

            // Reduce emissive in dark mode if it exists
            if (object.material.emissive) {
              if (object.material.emissiveIntensity !== undefined) {
                object.material.emissiveIntensity = 0.05;
              }
            }
          }

          // Adjust material properties for theme
          if (object.material.metalness !== undefined) {
            object.material.metalness = isDarkMode ? 0.6 : 0.4;
          }
          if (object.material.roughness !== undefined) {
            object.material.roughness = isDarkMode ? 0.4 : 0.45;
          }
        }
      }
    });
  };

  // Effect to update scene when theme changes
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;

    // Update renderer
    updateRendererForTheme(rendererRef.current);

    // Update lights
    setupLights(sceneRef.current);

    // Update model materials
    if (modelRef.current) {
      updateModelMaterials(modelRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDarkMode]); // This effect runs when the theme changes

  return (
    <div
      ref={containerRef}
      className="h-full w-full cursor-grab active:cursor-grabbing relative"
      style={{ height: "100%", width: "100%" }}
    >
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center justify-center">
            <div className="text-xl font-bold text-primary mb-2">FirstByte</div>
            <div className="w-40 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out animate-pulse"
                style={{ width: "60%" }}
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Loading model...
            </div>
          </div>
        </div>
      )}

      {isLoaded && showPrompt && (
        <div className="absolute top-[85%] md:top-[80%] left-[8%] md:left-[18%] transform -translate-y-1/2 z-20 pointer-events-none animate-fade-in prompt-message">
          <div className="animate-bounce-gentle flex flex-col items-start space-y-1">
            <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">
              FirstByte
            </p>
            <div
              className="relative bg-[#E5E5EA] dark:bg-[#2C2C2E] px-4 py-2.5 rounded-2xl rounded-bl-none shadow-lg max-w-[150px] md:max-w-[170px] 
                          before:content-[''] before:absolute before:bottom-0 before:left-[-10px] before:w-[20px] before:h-[18px] 
                          before:bg-[#E5E5EA] dark:before:bg-[#2C2C2E] 
                          before:[clip-path:path('M_0_18_C_12_18_12_0_20_0_L_20_18_Z')]
                          "
            >
              <p className="text-sm md:text-base font-medium text-black dark:text-white whitespace-nowrap">
                Drag to rotate me!
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 ml-1">now</p>
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
          <div className="p-6 text-center bg-background/90 rounded-lg">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Code size={24} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">FirstByte</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Empowering the next generation
            </p>
            <p className="text-xs text-destructive">Could not load 3D model</p>
          </div>
        </div>
      )}
    </div>
  );
}
