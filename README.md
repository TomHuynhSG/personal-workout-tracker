# 🏋️ Personal Workout Tracker

A modern, feature-rich, single-page web application designed to help you track your workout progress with ease. Built with vanilla HTML, CSS, and JavaScript, and powered by a Supabase backend, this application provides an intuitive interface for logging, reviewing, and analyzing your training sessions.

## ✨ Features

- **Interactive Workout Sessions:**
    - Start a new workout or edit any past session.
    - Automatically populates new sessions with the number of sets from your last performance of each exercise.
    - Previous weight and reps are shown as placeholders to encourage progressive overload.
    - Dynamically add or remove sets and exercises during a session.
- **Real-time Calculations:**
    - **Live Volume Tracking:** Total volume (Weight x Reps) is calculated and displayed instantly as you enter data.
    - **Performance Comparison:** See a real-time percentage and absolute volume change compared to the last time you performed an exercise.
    - **"New PR!" Alerts:** Get immediate feedback with a badge when you set a new personal record for weight or reps on any set.
- **Comprehensive Dashboard:**
    - **Workout Calendar:** A beautiful, interactive calendar view of your entire workout history. Click any marked day to view or edit that session.
    - **Motivational Stats:** At-a-glance badges for your current workout streak, workouts this week, and workouts this month.
    - **Personal Records:** A scrollable list of your best lift (heaviest weight for reps) for every exercise you've performed.
- **Insightful Data Visualization:**
    - **Muscle Group Distribution:** A pie chart showing the percentage of your total volume dedicated to each muscle group (Chest, Back, etc.).
    - **Overall Volume Trend:** A line chart tracking your total workout volume over time.
    - **Exercise-Specific Progress:** A filterable line chart to track your volume progression for any individual exercise.
- **Customization & Usability:**
    - **Dark Mode:** A sleek dark theme that can be toggled on/off and is saved to your browser's preferences.
    - **Touch-Friendly Interface:** All buttons, inputs, and interactive elements are sized for easy use on mobile and tablet devices.
    - **Add New Exercises:** Easily expand your exercise library on the fly.

## 🛠️ Tech Stack

- **Frontend:**
    - HTML5
    - CSS3
    - Vanilla JavaScript
- **Frameworks & Libraries:**
    - [Bootstrap 5](https://getbootstrap.com/) for responsive layout and components.
    - [FullCalendar](https://fullcalendar.io/) for the interactive workout calendar.
    - [Chart.js](https://www.chartjs.org/) for data visualization.
- **Backend:**
    - [Supabase](https://supabase.io/) for the PostgreSQL database and auto-generated APIs.

## 🚀 Setup and Installation

To get this project running on your local machine, follow these steps:

1.  **Clone the Repository (Optional):**
    ```bash
    git clone https://github.com/TomHuynhSG/personal-workout-tracker.git
    cd personal-workout-tracker
    ```

2.  **Set up Supabase:**
    - Go to [Supabase](https://supabase.io/) and create a new project.
    - Navigate to the **SQL Editor** in your new project.
    - Copy the entire content of the `setup.sql` script (provided below) and run it. This will create and configure all the necessary tables.

3.  **Configure Credentials:**
    - In your Supabase project, go to **Project Settings** > **API**.
    - Find your **Project URL** and **`anon` public API Key**.
    - Open the `supabaseClient.js` file in the project.
    - Paste your URL and Key into the `SUPABASE_URL` and `SUPABASE_KEY` constants, respectively.

4.  **Run the Application:**
    - Simply open the `index.html` file in your web browser. A live server extension for your code editor is recommended for the best experience.

## 📄 `setup.sql`

Run this script in your Supabase SQL Editor to initialize the database.

```sql
-- Drop existing tables in reverse order of dependency to avoid errors
DROP TABLE IF EXISTS sets;
DROP TABLE IF EXISTS workout_sessions;
DROP TABLE IF EXISTS exercises;

-- Create the exercises table
CREATE TABLE exercises (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE,
    muscle_group TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create the workout_sessions table
CREATE TABLE workout_sessions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create the sets table
CREATE TABLE sets (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    workout_session_id BIGINT REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id BIGINT REFERENCES exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    weight NUMERIC,
    reps INT,
    volume NUMERIC GENERATED ALWAYS AS (weight * reps) STORED,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Insert initial exercises
INSERT INTO exercises (name, muscle_group) VALUES
('Incline Dumbbell Press', 'Chest'),
('Flat Dumbbell Press', 'Chest'),
('Dumbbell Chest-Supported Row', 'Back'),
('Single Arm Dumbbell Row', 'Back'),
('Seated Dumbbell Press', 'Shoulders'),
('Dumbbell Lateral Raise', 'Shoulders'),
('Wall Leaning Dumbbell Lateral Raise', 'Shoulders'),
('Seated Incline Dumbbell Curls', 'Arms'),
('Preacher Dumbbell Curls', 'Arms'),
('Standing Overhead Dumbbell Extension', 'Arms'),
('Dumbbell Romanian Deadlifts', 'Legs');
```

## ✍️ Author

- **Huynh Nguyen Minh Thong (Tom Huynh)**
