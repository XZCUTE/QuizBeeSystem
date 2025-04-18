# ICCT Quiz Bee System

A real-time quiz application built with React, Vite, and Firebase. 

## Features

- Create quizzes with multiple-choice or fill-in-the-blank questions
- Set timer, points, and difficulty for each question
- Join quizzes with a 6-digit code
- Real-time participant list and quiz synchronization
- Team and individual leaderboards
- Multiple difficulty levels (Easy, Intermediate, Hard, Difficult, Tie-Breaker)

## Scoring System

The quiz implements a comprehensive scoring system that rewards both accuracy and speed:

### Basic Score Calculation

Scores are calculated using the following formula:

```
Score = basePoints * difficultyMultiplier * (0.5 + timeBonus * 0.5)
```

Where:
- `basePoints`: The base point value assigned to each question (default: 100)
- `difficultyMultiplier`: A multiplier based on question difficulty
- `timeBonus`: A percentage of time remaining (faster answers earn higher bonuses)

### Difficulty Multipliers

Questions can be assigned different difficulty levels, each with a corresponding multiplier:

| Difficulty Level | Multiplier |
|------------------|------------|
| Easy             | 1.0        |
| Intermediate     | 1.5        |
| Hard             | 2.0        |
| Difficult        | 2.5        |
| Tie-Breaker      | 3.0        |

### Time Bonus

The time bonus is calculated as a percentage of the remaining time:

```
timeBonus = remainingTime / totalTime
```

This means answering a question immediately can earn up to 50% more points than answering at the last second.

## Tie-Breaker System

When participants have equal scores, the application implements a sophisticated tie-breaking mechanism:

1. **Tie-Breaker Questions**: Special questions marked with the "tie-breaker" difficulty.
2. **First-Correct-Answer Ranking**: If two participants have the same score, the participant who was first to correctly answer a tie-breaker question ranks higher.
3. **Answer Timestamp**: The system records the exact timestamp when each answer was submitted using the Firebase server timestamp.
4. **Fallback Mechanism**: If neither participant has answered a tie-breaker question correctly (or if there are no tie-breaker questions), the system falls back to using the timestamp of their last answer as a tiebreaker.

### Viewing Tie-Breaker Results

Host can view detailed tie-breaker statistics in real-time:

1. During the quiz, hosts can toggle to the "Tie-Breakers" view to see who answered tie-breaker questions first.
2. The first participant to correctly answer each tie-breaker question is highlighted.
3. Timestamps for all correct answers are displayed to ensure transparency.

## Team Scoring

The application also supports team-based scoring:

1. Participants can be assigned to teams.
2. Team scores are calculated as the sum of all team members' individual scores.
3. Teams can be filtered and viewed separately in the Leaderboard.

## Participant Ranking

The final ranking of participants is determined by:

1. Total score (highest first)
2. Tie-breaker question ranking (if scores are equal)
3. Last answer timestamp (if scores are equal and no tie-breaker differentiation)

This ensures a fair and transparent ranking system even when multiple participants achieve the same score.

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd Rahoot
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Environment Variables

Create a `.env` file in the root directory with the following:

```
VITE_WEBSOCKET_URL=http://localhost:3001
```

### Running the Application

1. Start the development server

```bash
npm run all-dev
# or
yarn all-dev
```

2. Open your browser to `http://localhost:3000`

### Building for Production

```bash
npm run build
# or
yarn build
```

## Project Structure

```
src/
 ├── App.jsx           # Main application with routes
 ├── main.jsx          # Application entry point
 ├── assets/           # Static assets
 ├── components/       # Reusable components
 │   └── quiz/         # Quiz-specific components
 ├── context/          # React context providers
 ├── firebase/         # Firebase configuration
 ├── pages/            # Route components
 └── styles/           # Global styles
```

## Technology Stack

- React 18
- Vite
- Firebase Realtime Database
- Socket.io
- React Router
- Tailwind CSS
