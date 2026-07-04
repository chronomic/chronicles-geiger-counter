# ☢️ Chronicles Geiger Counter & Performance Lab

An immersive, highly interactive React application that visualizes component re-renders as radioactive events. Built with an atmospheric sci-fi CRT aesthetic, it utilizes `react-geiger` to turn your performance bottlenecks into audible Geiger counter clicks.

![Geiger Counter Interface Preview](public/favicon.svg) <!-- You can replace this with a real screenshot! -->

## ✨ Features

- **📺 Immersive CRT Interface:** A beautifully crafted, responsive dashboard with scanlines, chromatic aberration, and glowing terminal aesthetics.
- **🔊 Auditory Performance Feedback:** Integrates `react-geiger` and the React Profiler to emit realistic Geiger counter clicks whenever components re-render. The slower the render, the more intense the click.
- **🧪 Interactive Isotope Chamber:** Move your cursor across the "Reactor Core" canvas to spawn radioactive particles. The density and speed of particles dynamically push the React rendering engine, translating into visual intensity and audible radiation.
- **☢️ Multiple Isotope Modes:** Select between various fictional and real isotopes (Uranium-235, Plutonium-239, Chronium-X) to modify the base behavior, danger levels, and visual theming of the interface.
- **📈 Real-time Oscilloscope:** Visualizes the current "radiation intensity" (render pressure) through a dynamic, scrolling wave function.
- **📱 Responsive Design:** Flawlessly adapts from ultra-wide desktop monitors down to mobile screens without breaking the immersion.

## 🚀 Live Demo

[View the Live Application on Vercel](https://chronicles-geiger-counter.vercel.app/)

## 🛠️ Tech Stack

- **Framework:** React 19 + Vite
- **Styling:** Vanilla CSS (Tailored variables, CSS Grid/Flexbox, Custom Animations)
- **Audio/Profiling:** [react-geiger](https://github.com/karl-run/react-geiger) & React Profiler
- **Canvas:** HTML5 Canvas API for interactive particle physics

## 📦 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/chronomic/chronicles-geiger-counter.git
   cd chronicles-geiger-counter
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   *Note: This project contains a custom Vite alias configuration to ensure the React Profiler remains active in production builds for `react-geiger` to function properly on platforms like Vercel.*
   ```bash
   npm run build
   npm run preview
   ```

## 🎨 Design Philosophy

This project was built with a strong emphasis on **Premium UI/UX**. Every border, shadow, text size, and spacing unit was meticulously aligned to create a dashboard that feels alive and dangerous. By avoiding generic component libraries, the styling retains a highly tailored, "industrial-scientific" vibe.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---
*Engineered by Chronicles Studio*
