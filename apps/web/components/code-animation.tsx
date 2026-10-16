"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTheme } from "next-themes";

const codeSnippets = [
  {
    language: "Python",
    code: `def fibonacci(n):
  if n <= 1:
      return n
  else:
      return fibonacci(n-1) + fibonacci(n-2)

# Print the first 10 Fibonacci numbers
for i in range(10):
  print(fibonacci(i))`,
    color: "#3572A5",
  },
  {
    language: "JavaScript",
    code: `function createGame() {
  const player = {
    x: 50,
    speed: 5
  };
  function update() {
    if (keys.ArrowRight) player.x += player.speed;
    if (keys.ArrowLeft) player.x -= player.speed;
    draw();
    requestAnimationFrame(update);
  }
  update();
}
createGame();`,
    color: "#f7df1e",
  },
  {
    language: "HTML/CSS",
    code: `<div class="card">
  <div class="card-header">
    <h2>FirstByte Workshop</h2>
  </div>
  <div class="card-body">
    <p>Welcome to your first coding project!</p>
    <button class="btn">Run Code</button>
  </div>
</div>
<style>
.card {
  background-color: white;
  overflow: hidden;
  margin: 20px;
}
</style>`,
    color: "#e34c26",
  },
];

const mobileCodeSnippets = [
  {
    language: "Python",
    code: `def fib(n):
  if n <= 1:
      return n
  else:
      return fib(n-1) + fib(n-2)
for i in range(10):
  print(fib(i))`,
    color: "#3572A5",
  },
  {
    language: "JavaScript",
    code: `while (player.alive) {
  if (keys.ArrowRight) player.x += player.speed;
  if (keys.ArrowLeft) player.x -= player.speed;
  draw();
}
runGame();`,
    color: "#f7df1e",
  },
  {
    language: "HTML/CSS",
    code: `<div class="card">
  <h2>FirstByte Workshop</h2>
  <div class="card-body">
    <p>Your first coding project!</p>
    <button class="btn">Run Code</button>
  </div>
</div>`,
    color: "#e34c26",
  },
];

export function CodeAnimation() {
  const [currentSnippet, setCurrentSnippet] = useState(0);
  const [typing, setTyping] = useState(true);
  const [screenMediumPlus, setMediumPlus] = useState(true);
  const [text, setText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const { resolvedTheme } = useTheme();
  const isLightTheme = resolvedTheme === "light";
  // Type only while on screen. Before, it set state every 30 ms forever.
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef);

  // Detect screen size
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    setMediumPlus(mediaQuery.matches);

    const handleResize = () => setMediumPlus(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleResize);
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  // Typing effect
  useEffect(() => {
    if (!typing || !isInView) return;

    const currentSet = screenMediumPlus ? codeSnippets : mobileCodeSnippets;
    const snippet = currentSet[currentSnippet].code;

    if (cursorPosition < snippet.length) {
      const id = setTimeout(() => {
        setText((prev) => prev + snippet.charAt(cursorPosition));
        setCursorPosition((prev) => prev + 1);
      }, 30);
      return () => clearTimeout(id);
    } else {
      setTyping(false);
    }
  }, [typing, isInView, cursorPosition, currentSnippet, screenMediumPlus]);

  // Delay before moving to next snippet
  useEffect(() => {
    if (typing || !isInView) return;

    const id = setTimeout(() => {
      setText("");
      setCursorPosition(0);
      setCurrentSnippet((prev) => (prev + 1) % codeSnippets.length);
      setTyping(true);
    }, 5000);

    return () => clearTimeout(id);
  }, [typing, isInView]);

  const currentSet = screenMediumPlus ? codeSnippets : mobileCodeSnippets;
  const language = currentSet[currentSnippet].language;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${isLightTheme ? "bg-zinc-100" : "bg-zinc-900"} rounded-lg overflow-hidden shadow-xl`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 ${isLightTheme ? "bg-zinc-200" : "bg-zinc-800"}`}
      >
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div
          className={`text-xs ${isLightTheme ? "text-zinc-600" : "text-zinc-400"} font-mono`}
        >
          {language}
        </div>
      </div>

      <div
        className={`p-4 font-mono text-sm ${isLightTheme ? "text-zinc-800" : "text-white"} overflow-hidden h-[calc(100%-45px)]`}
      >
        <pre className="whitespace-pre-wrap">
          {text}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className={`inline-block w-2 h-4 ${isLightTheme ? "bg-zinc-800" : "bg-white"}`}
          ></motion.span>
        </pre>
      </div>
    </div>
  );
}
