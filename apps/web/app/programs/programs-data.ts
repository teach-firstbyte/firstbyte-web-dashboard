export interface Program {
  id: string;
  title: string;
  icon: string;
  description: string;
  image: string;
  longDescription?: string;
  details?: {
    duration?: string;
    ageRange?: string;
    capacity?: string;
    location?: string;
    schedule?: string;
  };
  tags?: string[];
  category?: string;
}

// Program data expanded from the programs section
export const programsData: Program[] = [
  {
    id: "cs-education",
    title: "CS Education",
    icon: "Laptop",
    description:
      "We lead various workshops with organizations like Camp Harbor View, teaching students computer science fundamentals like web development, Python, Scratch, and more!",
    image: "/programs/CHV.jpeg",
    longDescription:
      "Our comprehensive computer science education program introduces students to the fundamentals of computer science. Exploring programming and computational thinking through fun hands-on projects and interactive lessons. Our curriculum, spanning web development, robotics, and artificial intelligence is designed to be accessible to both beginners and those with prior experience.",
    details: {
      duration: "10 weeks",
      ageRange: "12-18 years",
      capacity: "25 students per class",
      location: "Partner schools and community centers",
      schedule: "Monthly",
    },
    tags: ["Programming", "Web Development", "Robotics"],
    category: "Core Program",
  },
  {
    id: "northeastern-workshops",
    title: "Northeastern Workshops",
    icon: "Code",
    description:
      "We run specialized workshops at Northeastern, for Northeastern students, covering essential developer skills such as React, Git, and command-line tools.",
    image: "/programs/GM.jpg",
    longDescription:
      "Our on-campus workshops, led by Northeastern students and taught to Northeastern students, provide in-depth lessons that build skills in software development through hands-on experience with industry-standard tools. Our experienced team seeks to share their knowledge and experience with with the greater Northeastern community through workshops like how to build your own full stack web app!",
    details: {
      duration: "Single-day to weekend workshops",
      ageRange: "17-23 years",
      capacity: "20 students per workshop",
      location: "On campus with online offerings available",
      schedule: "Monthly",
    },
    tags: ["Career Development", "React", "Git"],
    category: "Workshop",
  },
  {
    id: "hackathons",
    title: "Hackathons",
    icon: "Puzzle",
    description:
      "We help organize hackathons in collaboration with student organizations like HackBeanPot and ViTAL, creating opportunities for students to apply their skills to real-world challenges.",
    image: "/programs/VITAL.jpeg",
    longDescription:
      "In partnership with on-campus organizations like HackBeanPot and ViTAL, our team helps design and run immersive hackathon experiences that bring together students from all disciplines. We coordinate with partner organizations to host hackathon events from networking to technical workshops—most recently hosting a frontend development session for ViTAL using Vite, React, Supabase, and Node.js. Throughout each event, we provide hands-on mentorship, project-structure best practices, and peer learning opportunities, empowering participants to prototype innovative solutions to pressing real-world problems.",
    details: {
      duration: "Single-day to weekend workshops",
      ageRange: "All ages",
      capacity: "Unlimited",
      location: "Virtual and in-person community spaces",
      schedule: "Regular meetups and continuous online engagement",
    },
    tags: ["Networking", "Peer Learning", "Mentorship", "Collaboration"],
    category: "Community",
  },
  {
    id: "stem-education",
    title: "STEM Education",
    icon: "Lightbulb",
    description:
      "We partner with organizations like Saint Stephens Youth Program to deliver engaging STEM activities that make technical concepts accessible and fun for all students.",
    image: "/programs/SSYP.jpeg",
    longDescription:
      "Our STEM workshops offer immersive, hands-on experiences across science, technology, engineering, and mathematics. Each workshop focuses on a specific topic, from robotics and electronics to 3D modeling and environmental science. Students engage in collaborative projects that demonstrate real-world applications of STEM concepts, fostering curiosity and creativity while building technical skills.",
    details: {
      duration: "10 weeks",
      ageRange: "12-18 years",
      capacity: "15 students per class",
      location: "Partner schools and community centers",
      schedule:
        "Daily sessions during summer; weekend options during school year",
    },
    tags: [
      "Project-Based Learning",
      "Game Development",
      "Web Apps",
      "Mobile Apps",
    ],
    category: "Core Program",
  },
  {
    id: "mentorship",
    title: "Mentorship",
    icon: "GraduationCap",
    description:
      "We provide resume review sessions and presentation practice to help students prepare for technical interviews and professional opportunities.",
    image: "/programs/CHV2.jpeg",
    longDescription:
      "Our mentorship program connects students with technology professionals who provide personalized guidance and career insights. Through regular one-on-one meetings and small group sessions, mentors help students explore tech pathways, develop professional skills, and navigate educational choices. This program bridges the gap between academic learning and industry realities, helping students build confidence and clarity about their future in technology.",
    details: {
      duration: "3-6 months per mentorship cycle",
      ageRange: "14-18 years",
      capacity: "Limited by mentor availability",
      location: "Virtual meetings with occasional in-person events",
      schedule: "Bi-weekly mentor sessions with monthly group events",
    },
    tags: [
      "Career Development",
      "Professional Skills",
      "Industry Insights",
      "Networking",
    ],
    category: "Support",
  },
  {
    id: "engineering-team",
    title: "Engineering Team",
    icon: "Users",
    description:
      "Our student-led engineering team develops and maintains our website and other digital resources, providing hands-on experience in software development.",
    image: "/programs/ENGINEERING.png",
    longDescription:
      "Our innovation challenges bring students together to tackle real-world problems using technology and creative thinking. These competitive events combine technical skill application with design thinking methodologies. Working in teams, participants go through the entire process of identifying problems, ideating solutions, and building functional prototypes. These challenges culminate in presentations to panels of industry experts, with recognition for outstanding projects.",
    details: {
      duration: "1-day sprints to 6-week challenges",
      ageRange: "18-21 years",
      capacity: "Teams of 5-6 students",
      location: "Online and in-person collaboration",
      schedule: "Quarterly challenges with annual showcase",
    },
    tags: ["Problem Solving", "Teamwork", "Design Thinking", "Prototyping"],
    category: "Competition",
  },
];

// Get all unique categories and tags for filtering
export const allCategories = [
  "All",
  ...new Set(
    programsData.map((program) => program.category || "Uncategorized"),
  ),
];
export const allTags = [
  ...new Set(programsData.flatMap((program) => program.tags || [])),
].sort();
