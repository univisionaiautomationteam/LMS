import type { Course, Language } from "../types";

export const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
  "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export const starterCourses: Course[] = [
  { slug: "python", title: "Python from Zero to Builder", language: "Python", category: "Computer Science", icon: "Py", color: "#6c5ce7", level: "Beginner", lessons: 42, duration: "8h 20m", description: "Build strong Python foundations through practical exercises, data structures, and a capstone project." },
  { slug: "cpp", title: "Modern C++ Essentials", language: "C++", category: "Computer Science", icon: "C+", color: "#147d64", level: "Intermediate", lessons: 36, duration: "10h 05m", description: "Master memory, object-oriented design, STL, templates, and modern C++ patterns." },
  { slug: "java", title: "Java & Object-Oriented Design", language: "Java", category: "Computer Science", icon: "Ja", color: "#d96843", level: "Beginner", lessons: 48, duration: "12h 10m", description: "Learn Java syntax, OOP, collections, exceptions, and production-ready design practices." },
  { slug: "c", title: "C Programming: Core Foundations", language: "C", category: "Computer Science", icon: "C", color: "#2f6fdd", level: "Beginner", lessons: 31, duration: "7h 45m", description: "Understand how programs work through pointers, memory, structs, files, and algorithms." },
  { slug: "embedded-systems", title: "Embedded Systems & Microcontrollers", language: "Embedded", category: "Electronics", icon: "ES", color: "#8a5a44", level: "Beginner", lessons: 34, duration: "9h 15m", description: "Design firmware, interfaces, and real-time applications with modern microcontrollers." },
  { slug: "vlsi", title: "VLSI Design & Verification", language: "VLSI", category: "Electronics", icon: "VL", color: "#7d4c92", level: "Intermediate", lessons: 40, duration: "11h 30m", description: "Learn digital design, Verilog, CMOS fundamentals, and verification workflows." },
  { slug: "ai-ml", title: "Artificial Intelligence & Machine Learning", language: "AI/ML", category: "AI & Data", icon: "AI", color: "#a44747", level: "Intermediate", lessons: 52, duration: "14h 20m", description: "Build practical foundations in machine learning, neural networks, and responsible AI." },
  { slug: "data-science", title: "Data Science & Analytics", language: "Data", category: "AI & Data", icon: "DS", color: "#2b7b78", level: "Beginner", lessons: 38, duration: "10h 40m", description: "Analyze, visualize, and model real-world datasets using modern tools." },
  { slug: "robotics", title: "Robotics & Industrial Automation", language: "Robotics", category: "Mechatronics", icon: "RB", color: "#4d6573", level: "Intermediate", lessons: 44, duration: "12h 00m", description: "Integrate sensing, control, actuation, and automation into robotic systems." },
  { slug: "iot", title: "Internet of Things Engineering", language: "IoT", category: "Electronics", icon: "IoT", color: "#26735e", level: "Beginner", lessons: 30, duration: "8h 45m", description: "Connect embedded devices securely through sensors, protocols, and cloud platforms." },
  { slug: "cybersecurity", title: "Cybersecurity Engineering", language: "Security", category: "Computer Science", icon: "CY", color: "#34495e", level: "Intermediate", lessons: 39, duration: "11h 20m", description: "Protect applications, systems, and networks through secure engineering practices." },
];

export const curriculum = [
  { title: "Welcome & setup", time: "06:12", type: "video" },
  { title: "Values, variables & types", time: "14:35", type: "video" },
  { title: "Control flow in practice", time: "18:20", type: "video" },
  { title: "Practice: shipping calculator", time: "20 min", type: "code" },
  { title: "Module knowledge check", time: "8 questions", type: "quiz" },
];

export const codeSamples: Record<Language, string> = {
  python: `name = input("Enter your name: ")\ngoal = input("What will you learn? ")\nprint(f"Hello, {name}!")\nprint(f"Today I will learn {goal}.")`,
  c: `#include <stdio.h>\n\nint main(void) {\n  char name[50];\n  scanf("%49s", name);\n  printf("Hello, %s!\\n", name);\n  return 0;\n}`,
  cpp: `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n  string name;\n  getline(cin, name);\n  cout << "Hello, " << name << "!" << endl;\n  return 0;\n}`,
  java: `import java.util.Scanner;\n\npublic class Main {\n  public static void main(String[] args) {\n    Scanner input = new Scanner(System.in);\n    String name = input.nextLine();\n    System.out.println("Hello, " + name + "!");\n  }\n}`,
};

export const quizQuestions = [
  { q: "Which Python type stores an ordered, mutable collection?", options: ["tuple", "list", "set", "string"], answer: 1 },
  { q: "What does a function return when no return value is specified?", options: ["0", "false", "None", "undefined"], answer: 2 },
  { q: "Which keyword begins a conditional branch?", options: ["when", "if", "case", "check"], answer: 1 },
];

export const STATE_POSITIONS: Record<string, { left: number; top: number }> = {
  "Jammu and Kashmir": { left: 38, top: 11 }, "Himachal Pradesh": { left: 45, top: 19 }, Punjab: { left: 38, top: 23 },
  Haryana: { left: 44, top: 27 }, Delhi: { left: 47, top: 30 }, Uttarakhand: { left: 52, top: 24 },
  Rajasthan: { left: 33, top: 36 }, Gujarat: { left: 25, top: 49 }, "Madhya Pradesh": { left: 47, top: 47 },
  Maharashtra: { left: 39, top: 59 }, Goa: { left: 34, top: 69 }, Karnataka: { left: 42, top: 72 },
  Kerala: { left: 44, top: 89 }, "Tamil Nadu": { left: 52, top: 85 }, Telangana: { left: 51, top: 64 },
  "Andhra Pradesh": { left: 57, top: 70 }, "Uttar Pradesh": { left: 57, top: 35 }, Bihar: { left: 69, top: 39 },
  Jharkhand: { left: 68, top: 47 }, Chhattisgarh: { left: 57, top: 54 }, Odisha: { left: 67, top: 57 },
  "West Bengal": { left: 77, top: 47 }, Assam: { left: 87, top: 35 }, Meghalaya: { left: 83, top: 39 },
  "Arunachal Pradesh": { left: 91, top: 27 }, Nagaland: { left: 93, top: 37 }, Manipur: { left: 91, top: 43 },
  Mizoram: { left: 87, top: 48 },
};

export function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
