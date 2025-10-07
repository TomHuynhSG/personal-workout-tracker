document.addEventListener('DOMContentLoaded', async () => {
    const formatDate = (dateSource) => {
        // If dateSource is a string (like from Supabase 'YYYY-MM-DD'), replace hyphens to parse it as local time, not UTC.
        const date = typeof dateSource === 'string' ? new Date(dateSource.replace(/-/g, '/')) : new Date(dateSource);
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatShortDate = (dateSource) => {
        const date = typeof dateSource === 'string' ? new Date(dateSource.replace(/-/g, '/')) : new Date(dateSource);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    const homepage = document.getElementById('homepage');
    const workoutSession = document.getElementById('workout-session');
    const newWorkoutBtn = document.getElementById('new-workout-btn');
    const workoutTableBody = document.getElementById('workout-table-body');
    const sessionDate = document.getElementById('session-date');
    const workoutForm = document.getElementById('workout-form');
    const homeLink = document.getElementById('home-link');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggleBtn.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggleBtn.textContent = '🌙';
        }
    };

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        workoutSession.classList.add('d-none');
        homepage.classList.remove('d-none');
    });

    newWorkoutBtn.addEventListener('click', async () => {
        await startWorkoutSession();
    });

    async function startWorkoutSession(sessionId = null) {
        homepage.classList.add('d-none');
        workoutSession.classList.remove('d-none');
        workoutForm.dataset.sessionId = sessionId || '';

        if (sessionId) {
            const { data: sessionData } = await supabaseClient.from('workout_sessions').select('date').eq('id', sessionId).single();
            sessionDate.textContent = `Workout Session - ${formatDate(sessionData.date)}`;
        } else {
            const today = new Date();
            sessionDate.textContent = `Workout Session - ${formatDate(today)}`;
        }
        
        await populateWorkoutTable(sessionId);
    }

    async function populateWorkoutTable(sessionId = null) {
        workoutTableBody.innerHTML = ''; // Clear existing rows
        const exercises = await getExercises();

        let setsForEditing = [];
        if (sessionId) { // If we are editing a specific session, load its sets
            const { data } = await supabaseClient.from('sets').select('*').eq('workout_session_id', sessionId);
            setsForEditing = data || [];
        }

        for (const exercise of exercises) {
            const row = document.createElement('tr');
            row.dataset.exerciseId = exercise.id;
            row.dataset.exerciseName = exercise.name;

            // --- New, Corrected Logic ---
            let previousVolume = 0;
            let previousDate = 'N/A';
            let setsForPlaceholders = [];

            // 1. Find the most recent session DATE for this specific exercise
            const { data: lastSessionWithExercise, error: lastSessionError } = await supabaseClient
                .from('workout_sessions')
                .select('id, date, sets!inner(exercise_id)')
                .eq('sets.exercise_id', exercise.id)
                .order('date', { ascending: false })
                .limit(1)
                .single();

            // 2. If a session was found, fetch all sets for that exercise from that specific session
            if (lastSessionWithExercise) {
                previousDate = formatShortDate(lastSessionWithExercise.date);
                const { data: setsInLastSession, error: setsError } = await supabaseClient
                    .from('sets')
                    .select('weight, reps, volume')
                    .eq('workout_session_id', lastSessionWithExercise.id)
                    .eq('exercise_id', exercise.id);

                if (setsInLastSession) {
                    previousVolume = setsInLastSession.reduce((sum, set) => sum + (set.volume || 0), 0);
                    setsForPlaceholders = setsInLastSession;
                }
            }
            row.dataset.lastVolume = previousVolume;
            // --- End of New Logic ---

            let setsHtml = '';
            if (sessionId) { // Editing an existing session
                const setsToLoad = setsForEditing.filter(s => s.exercise_id === exercise.id);
                if (setsToLoad.length > 0) {
                    setsToLoad.forEach(s => {
                        setsHtml += `
                            <div class="set mt-2">
                                <input type="number" class="form-control d-inline-block set-input weight-input" placeholder="${s.weight || 'kg'}" value="${s.weight || ''}">
                                <input type="number" class="form-control d-inline-block set-input reps-input" placeholder="${s.reps || 'reps'}" value="${s.reps || ''}">
                            </div>
                        `;
                    });
                }
            } else { // Starting a new session, use placeholders from the last performance
                if (setsForPlaceholders.length > 0) {
                    setsForPlaceholders.forEach(s => {
                        setsHtml += `
                            <div class="set mt-2">
                                <input type="number" class="form-control d-inline-block set-input weight-input" placeholder="${s.weight || 'kg'}">
                                <input type="number" class="form-control d-inline-block set-input reps-input" placeholder="${s.reps || 'reps'}">
                            </div>
                        `;
                    });
                }
            }

            // If no sets were found for either case, default to one empty set
            if (setsHtml === '') {
                setsHtml = `
                    <div class="set position-relative">
                        <input type="number" class="form-control d-inline-block set-input weight-input" placeholder="kg">
                        <input type="number" class="form-control d-inline-block set-input reps-input" placeholder="reps">
                    </div>
                `;
            }

            row.innerHTML = `
                <td>${exercise.name}</td>
                <td class="sets-container">${setsHtml}</td>
                <td class="volume"><span class="badge bg-primary volume-badge">0</span></td>
                <td class="previous-volume">${previousVolume > 0 ? `<span class="badge bg-danger volume-badge">${previousVolume.toFixed(1)}</span> - ${previousDate}` : 'N/A'}</td>
                <td class="change">N/A</td>
                <td>
                    <button type="button" class="btn btn-sm btn-info add-set-btn">Add Set</button>
                    <button type="button" class="btn btn-sm btn-danger delete-set-btn mt-1">Delete Set</button>
                    <button type="button" class="btn btn-sm btn-warning delete-exercise-btn mt-1">Delete Exercise</button>
                </td>
            `;
            workoutTableBody.appendChild(row);
            calculateVolume(row);
        }
    }

    async function getExercises() {
        const { data, error } = await supabaseClient.from('exercises').select('*').order('id', { ascending: true });
        if (error) {
            console.error('Error fetching exercises:', error);
            return [];
        }
        return data;
    }

    async function initializeCalendar() {
        const calendarEl = document.getElementById('calendar-container');
        const { data: sessions, error } = await supabaseClient
            .from('workout_sessions')
            .select('id, date, created_at');

        if (error) {
            console.error('Error fetching sessions for calendar:', error);
            return;
        }

        const events = sessions.map(session => {
            const startTime = new Date(session.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return {
                title: `Workout ${startTime}`,
                start: session.date,
                allDay: true,
                extendedProps: {
                    sessionId: session.id
                }
            };
        });

        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            events: events,
            eventClick: function(info) {
                const sessionId = info.event.extendedProps.sessionId;
                startWorkoutSession(sessionId);
            },
            eventColor: '#198754'
        });

        calendar.render();
    }

    workoutTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-set-btn')) {
            const setsContainer = e.target.closest('tr').querySelector('.sets-container');
            const newSet = document.createElement('div');
            newSet.className = 'set mt-2';
            const lastWeightPlaceholder = setsContainer.querySelector('.weight-input:last-of-type')?.placeholder || 'kg';
            const lastRepsPlaceholder = setsContainer.querySelector('.reps-input:last-of-type')?.placeholder || 'reps';
            newSet.innerHTML = `
                <input type="number" class="form-control d-inline-block set-input weight-input" placeholder="${lastWeightPlaceholder}">
                <input type="number" class="form-control d-inline-block set-input reps-input" placeholder="${lastRepsPlaceholder}">
            `;
            setsContainer.appendChild(newSet);
        } else if (e.target.classList.contains('delete-set-btn')) {
            const setsContainer = e.target.closest('tr').querySelector('.sets-container');
            const allSets = setsContainer.querySelectorAll('.set');
            if (allSets.length > 1) { // Only delete if there's more than one set
                allSets[allSets.length - 1].remove();
                calculateVolume(e.target.closest('tr')); // Recalculate volume after deleting
            } else {
                alert('Each exercise must have at least one set.');
            }
        } else if (e.target.classList.contains('delete-exercise-btn')) {
            if (confirm('Are you sure you want to remove this exercise from the session?')) {
                e.target.closest('tr').remove();
            }
        }
    });

    workoutTableBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('weight-input') || e.target.classList.contains('reps-input')) {
            const row = e.target.closest('tr');
            calculateVolume(row);
        }
    });

    async function calculateVolume(row) {
        const sets = row.querySelectorAll('.set');
        let totalVolume = 0;
        sets.forEach(set => {
            const weight = parseFloat(set.querySelector('.weight-input').value) || 0;
            const reps = parseInt(set.querySelector('.reps-input').value) || 0;
            totalVolume += weight * reps;
        });
        row.querySelector('.volume .badge').textContent = totalVolume.toFixed(1);

        // Check for new PRs in real-time
        sets.forEach(async (setElement) => {
            const weight = parseFloat(setElement.querySelector('.weight-input').value) || 0;
            const reps = parseInt(setElement.querySelector('.reps-input').value) || 0;
            if (weight > 0 && reps > 0) {
                const { data: pr } = await supabaseClient
                    .from('sets')
                    .select('weight, reps')
                    .eq('exercise_id', row.dataset.exerciseId)
                    .order('weight', { ascending: false })
                    .order('reps', { ascending: false })
                    .limit(1)
                    .single();
                
                let isPr = !pr || (weight > pr.weight) || (weight === pr.weight && reps > pr.reps);

                let prBadge = setElement.querySelector('.pr-badge');
                if (isPr) {
                    if (!prBadge) {
                        prBadge = document.createElement('span');
                        prBadge.className = 'badge bg-danger pr-badge';
                        prBadge.textContent = 'New PR!';
                        prBadge.style.position = 'absolute';
                        prBadge.style.top = '-10px';
                        prBadge.style.right = '-10px';
                        setElement.appendChild(prBadge);
                    }
                } else {
                    if (prBadge) {
                        prBadge.remove();
                    }
                }
            }
        });

        // Calculate change vs last workout using pre-fetched data
        const lastSessionVolume = parseFloat(row.dataset.lastVolume) || 0;

        if (lastSessionVolume > 0 && totalVolume > 0) {
            const percentageChange = ((totalVolume - lastSessionVolume) / lastSessionVolume) * 100;
            const absoluteChange = totalVolume - lastSessionVolume;
            const changeCell = row.querySelector('.change');
            const sign = absoluteChange >= 0 ? '+' : '';

            changeCell.textContent = `${sign}${percentageChange.toFixed(1)}% (${sign}${absoluteChange.toFixed(1)} kg)`;
            changeCell.style.color = absoluteChange >= 0 ? 'green' : 'red';
        } else {
            row.querySelector('.change').textContent = 'N/A';
        }
    }

    workoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let sessionId = workoutForm.dataset.sessionId;

        // If it's a new session, create it first
        if (!sessionId) {
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            const { data: sessionData, error: sessionError } = await supabaseClient
                .from('workout_sessions')
                .insert({ date: today })
                .select('id')
                .single();

            if (sessionError) {
                console.error('Error creating session:', sessionError);
                alert('Failed to save session.');
                return;
            }
            sessionId = sessionData.id;
        } else {
            // If we are editing an existing session, first delete all its old sets
            await supabaseClient.from('sets').delete().eq('workout_session_id', sessionId);
        }

        const allSets = [];
        const rows = workoutTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const exerciseId = row.dataset.exerciseId;
            const sets = row.querySelectorAll('.set');
            let setNumber = 1;
            sets.forEach(set => {
                const weight = parseFloat(set.querySelector('.weight-input').value);
                const reps = parseInt(set.querySelector('.reps-input').value);
                if (!isNaN(weight) && !isNaN(reps)) {
                    allSets.push({
                        workout_session_id: sessionId,
                        exercise_id: exerciseId,
                        set_number: setNumber++,
                        weight: weight,
                        reps: reps
                    });
                }
            });
        });

        if (allSets.length > 0) {
            const { error: setsError } = await supabaseClient.from('sets').insert(allSets);
            if (setsError) {
                console.error('Error saving sets:', setsError);
                alert('Failed to save workout details.');
                return;
            }
        }

        alert('Workout session saved successfully!');
        workoutSession.classList.add('d-none');
        homepage.classList.remove('d-none');
        loadPastSessions();
        loadDashboardCharts(); // Refresh charts
    });

    document.getElementById('add-exercise-btn').addEventListener('click', async () => {
        const newExerciseName = prompt('Enter the name of the new exercise:');
        if (newExerciseName && newExerciseName.trim() !== '') {
            const { data, error } = await supabaseClient
                .from('exercises')
                .insert({ name: newExerciseName.trim() })
                .select()
                .single();

            if (error) {
                console.error('Error adding new exercise:', error);
                alert('Failed to add exercise. It might already exist.');
                return;
            }

            // Add the new exercise to the current session's table
            const row = document.createElement('tr');
            row.dataset.exerciseId = data.id;
            row.dataset.exerciseName = data.name;
            row.innerHTML = `
                <td>${data.name}</td>
                <td class="sets-container">
                    <div class="set">
                        <input type="number" class="form-control d-inline-block set-input weight-input" placeholder="kg">
                        <input type="number" class="form-control d-inline-block set-input reps-input" placeholder="reps">
                    </div>
                </td>
                <td class="volume">0</td>
                <td class="change">N/A</td>
                <td><button type="button" class="btn btn-sm btn-info add-set-btn">Add Set</button></td>
            `;
            workoutTableBody.appendChild(row);
            alert(`Exercise "${data.name}" added successfully!`);
        }
    });

    let overallVolumeChart = null;
    let exerciseProgressChart = null;
    let muscleGroupChart = null;

    async function loadDashboardCharts() {
        const { data, error } = await supabaseClient
            .from('workout_sessions')
            .select('date, sets(*, exercises(id, name, muscle_group))')
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching data for charts:', error);
            return;
        }

        if (data.length === 0) return;

        // Process data for Muscle Group Chart
        const muscleGroupVolumes = data.flatMap(s => s.sets).reduce((acc, set) => {
            const group = set.exercises.muscle_group;
            if (!acc[group]) {
                acc[group] = 0;
            }
            acc[group] += set.volume || 0;
            return acc;
        }, {});

        const muscleGroupCtx = document.getElementById('muscleGroupChart').getContext('2d');
        if (muscleGroupChart) muscleGroupChart.destroy();
        muscleGroupChart = new Chart(muscleGroupCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(muscleGroupVolumes),
                datasets: [{
                    label: 'Volume by Muscle Group',
                    data: Object.values(muscleGroupVolumes),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                    ],
                }]
            }
        });

        // Process data for overall volume chart
        const sessionVolumes = data.map(session => {
            const totalVolume = session.sets.reduce((sum, set) => sum + (set.volume || 0), 0);
            return { date: session.date, volume: totalVolume };
        });

        const overallVolumeCtx = document.getElementById('overallVolumeChart').getContext('2d');
        if (overallVolumeChart) overallVolumeChart.destroy();
        overallVolumeChart = new Chart(overallVolumeCtx, {
            type: 'line',
            data: {
                labels: sessionVolumes.map(s => formatDate(s.date)),
                datasets: [{
                    label: 'Total Volume (kg)',
                    data: sessionVolumes.map(s => s.volume),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    tension: 0.1
                }]
            }
        });

        // Process data for exercise progress chart
        const exerciseSelect = document.getElementById('exercise-select');
        const allExercises = await getExercises();
        exerciseSelect.innerHTML = allExercises.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

        const renderExerciseChart = () => {
            const selectedExerciseId = parseInt(exerciseSelect.value);
            const exerciseData = data.map(session => {
                const exerciseVolume = session.sets
                    .filter(set => set.exercises.id === selectedExerciseId)
                    .reduce((sum, set) => sum + (set.volume || 0), 0);
                return { date: session.date, volume: exerciseVolume };
            }).filter(d => d.volume > 0);

            const exerciseProgressCtx = document.getElementById('exerciseProgressChart').getContext('2d');
            if (exerciseProgressChart) exerciseProgressChart.destroy();
            exerciseProgressChart = new Chart(exerciseProgressCtx, {
                type: 'line',
                data: {
                    labels: exerciseData.map(d => formatDate(d.date)),
                    datasets: [{
                        label: `Volume for ${allExercises.find(e => e.id === selectedExerciseId).name} (kg)`,
                        data: exerciseData.map(d => d.volume),
                        borderColor: 'rgba(153, 102, 255, 1)',
                        tension: 0.1
                    }]
                }
            });
        };

        exerciseSelect.addEventListener('change', renderExerciseChart);
        renderExerciseChart(); // Initial render
    }

    async function calculateAndDisplayStreak() {
        const streakContainer = document.getElementById('streak-container');
        const { data: sessions, error } = await supabaseClient
            .from('workout_sessions')
            .select('date')
            .order('date', { ascending: false });

        if (error || !sessions || sessions.length === 0) {
            streakContainer.innerHTML = '';
            return;
        }

        // Create a set of unique, local date strings for easy lookup
        const workoutDates = new Set(sessions.map(s => new Date(s.date.replace(/-/g, '/')).toDateString()));
        
        let streak = 0;
        const today = new Date();
        let currentDate = new Date();

        // Check if today is a workout day
        if (workoutDates.has(today.toDateString())) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            // If today is not a workout day, start checking from yesterday
            currentDate.setDate(currentDate.getDate() - 1);
        }

        // Loop backwards from the day before the last counted day
        while (workoutDates.has(currentDate.toDateString())) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }

        // Calculate workouts this week
        const todayForWeek = new Date();
        const dayOfWeek = todayForWeek.getDay(); // Sunday = 0, Monday = 1, etc.
        const startOfWeek = new Date(todayForWeek);
        startOfWeek.setDate(todayForWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Adjust to Monday as start of week
        startOfWeek.setHours(0, 0, 0, 0);

        let workoutsThisWeek = 0;
        workoutDates.forEach(dateStr => {
            if (new Date(dateStr) >= startOfWeek) {
                workoutsThisWeek++;
            }
        });

        // Calculate workouts this month
        const startOfMonth = new Date(todayForWeek.getFullYear(), todayForWeek.getMonth(), 1);
        let workoutsThisMonth = 0;
        workoutDates.forEach(dateStr => {
            if (new Date(dateStr) >= startOfMonth) {
                workoutsThisMonth++;
            }
        });

        streakContainer.innerHTML = `
            <span class="badge bg-warning text-dark fs-5 mb-1 d-block">
                🔥 ${streak} Day Streak
            </span>
            <span class="badge bg-info text-dark fs-5 d-block mb-1">
                💪 ${workoutsThisWeek} Workouts This Week
            </span>
            <span class="badge bg-success text-white fs-5 d-block">
                🗓️ ${workoutsThisMonth} Workouts This Month
            </span>
        `;
    }

    async function loadPersonalRecords() {
        const prList = document.getElementById('pr-list');
        prList.innerHTML = ''; // Clear existing PRs

        const exercises = await getExercises();
        if (!exercises) return;

        let allPrs = [];

        for (const exercise of exercises) {
            const { data: bestSet, error: bestSetError } = await supabaseClient
                .from('sets')
                .select('weight, reps')
                .eq('exercise_id', exercise.id)
                .order('weight', { ascending: false })
                .order('reps', { ascending: false })
                .limit(1)
                .single();
            
            if (bestSet) {
                allPrs.push({
                    exerciseName: exercise.name,
                    weight: bestSet.weight,
                    reps: bestSet.reps
                });
            }
        }

        if (allPrs.length === 0) {
            prList.innerHTML = '<li class="list-group-item">No records yet. Go lift!</li>';
            return;
        }

        allPrs.forEach(pr => {
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <span>${pr.exerciseName}</span>
                <span class="badge bg-success rounded-pill">${pr.weight} kg x ${pr.reps} reps</span>
            `;
            prList.appendChild(item);
        });
    }

    // Initial Load
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    initializeCalendar();
    loadDashboardCharts();
    calculateAndDisplayStreak();
    loadPersonalRecords();
});
