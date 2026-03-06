# Developer Personality Analyzer

> Generate a fun, data-driven personality profile from commit history, language usage, and coding habits.
> Just drop in your Github profile or repo.

![Demo](https://img.shields.io/badge/stack-Node%20%7C%20React%20%7C%20Chart.js-7c3aed?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)

---

## ✨ What It Does

Enter any GitHub **username** (e.g. `torvalds`) or **owner/repo** (e.g. `facebook/react`\*\*\*\*) and get back:

## Features

**Personality Type**  
Identifies developer archetypes such as Night Owl, Chaos Engineer, Perfectionist Craftsman, Bug Slayer, and more.

**D&D Alignment**  
Maps your development style to one of the nine classic alignments, from Lawful Good Senior Dev to Chaotic Evil 3am Cowboy Deployer.

**Developer Class**  
Assigns a class inspired by RPG archetypes such as Wizard, Rogue, Paladin, Barbarian, Bard, Ranger, Cleric, or Monk.

**Personality Radar**  
A six-axis radar chart showing traits like Consistency, Productivity, Code Quality, Creativity, Collaboration, and Night Owl tendencies.

**Activity Heatmap**  
A GitHub-style 52-week contribution calendar based on repository activity.

**Language Profile**  
Displays the language distribution, polyglot score, stack archetype, and additional language insights.

**Commit Analysis**  
Analyzes commit patterns including time of day, day of week, commit types, and message styles.

**AI Summary**  
Generates an optional narrative personality report using OpenRouter. Falls back to a template summary if no API key is provided.

---

## 🛠️ Tech Stack

| Layer              | Technology                                                              |
| ------------------ | ----------------------------------------------------------------------- |
| Backend runtime    | Node.js 18+                                                             |
| Backend framework  | Express 5                                                               |
| GitHub data        | GitHub REST API v3 (via Axios)                                          |
| AI summaries       | OpenRouter API — configurable model (default: `deepseek/deepseek-chat`) |
| Frontend framework | React 18 + Vite                                                         |
| Charts             | Chart.js + react-chartjs-2                                              |
| Animations         | Framer Motion                                                           |
| Icons              | Lucide React                                                            |
| Notifications      | react-hot-toast                                                         |

---

## 🧠 Personality Types

| Type                       | Trigger Conditions                                   |
| -------------------------- | ---------------------------------------------------- |
| 🦉 Night Owl Engineer      | >30% commits midnight–4am                            |
| 🐦 Early Bird Coder        | >25% commits 5am–8am                                 |
| 💼 9-to-5 Professional     | Peak in morning + afternoon windows                  |
| ⚔️ Weekend Warrior         | >40% commits on Sat/Sun                              |
| 🔬 Perfectionist Craftsman | High refactor %, conventional commits, micro commits |
| 💥 Chaos Engineer          | Large commits, bursty cadence, many WIP commits      |
| 🔩 Micro-Optimizer         | >50% micro commits (≤5 lines), high commit frequency |
| 🌐 Polyglot Developer      | 5+ languages across repos                            |
| 📚 Documentation Hero      | High docs commit %, long messages with bodies        |
| 🏭 Feature Factory         | >40% of commits are `feat:` type                     |
| 🐛 Bug Slayer              | >35% of commits are `fix:` type                      |
| 🧘 DevOps Monk             | High chore/ci/build commit ratio                     |

---

## ⚔️ D&D Alignments

| Alignment          | Tagline                                     |
| ------------------ | ------------------------------------------- |
| ⚖️ Lawful Good     | The Senior Dev Everyone Wants on Their Team |
| 📋 Lawful Neutral  | The Process Enforcer                        |
| 😈 Lawful Evil     | The Ticket-Closer (Won't Fix)               |
| 😊 Neutral Good    | The Helpful Collaborator                    |
| ⚪ True Neutral    | The Pragmatic Problem Solver                |
| 🕶️ Neutral Evil    | The Silent Codebase Ninja                   |
| 🦸 Chaotic Good    | The Creative Genius Who Ships               |
| 🎲 Chaotic Neutral | The Hacker — Move Fast, Break Things        |
| 💀 Chaotic Evil    | The Legendary 3am Cowboy Deployer           |

---

---

_Built for fun. Personality results are algorithmic entertainment, not professional assessments._
