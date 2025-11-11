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
    const timerContainer = document.getElementById('timer-container');
    const timerSound = new Audio('sound/timer-up.mp3'); // Pre-load the sound

    let timerInterval = null;
    let timerSeconds = 0;

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerSeconds++;
            document.getElementById('timer-display').textContent = formatTime(timerSeconds);
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function resetTimer() {
        stopTimer();
        timerSeconds = 0;
    }

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
        window.location.href = 'index.html';
    });

    newWorkoutBtn.addEventListener('click', async () => {
        await startWorkoutSession();
    });

    async function startWorkoutSession(sessionId = null) {
        homepage.classList.add('d-none');
        workoutSession.classList.remove('d-none');
        workoutForm.dataset.sessionId = sessionId || '';
        timerContainer.innerHTML = ''; // Clear previous timer/duration

        if (sessionId) {
            document.getElementById('delete-session-btn').classList.remove('d-none');
            const { data: sessionData } = await supabaseClient.from('workout_sessions').select('date, duration').eq('id', sessionId).single();
            sessionDate.textContent = `Workout Session - ${formatDate(sessionData.date)}`;
            if (sessionData.duration) {
                timerContainer.innerHTML = `
                    <div class="d-flex flex-column flex-md-row align-items-center">
                        <span class="badge bg-info fs-5 mb-1 mb-md-0 me-md-2">Duration: ${formatTime(sessionData.duration)}</span>
                        <button type="button" id="continue-workout-btn" class="btn btn-sm btn-primary">Continue Workout</button>
                    </div>
                `;
                document.getElementById('continue-workout-btn').addEventListener('click', () => {
                    timerSeconds = sessionData.duration;
                    timerContainer.innerHTML = `
                        <div class="d-flex flex-column flex-md-row align-items-center">
                            <span id="timer-display" class="badge bg-success fs-5 mb-1 mb-md-0 me-md-2">${formatTime(timerSeconds)}</span>
                            <button type="button" id="timer-toggle-btn" class="btn btn-sm btn-warning">Pause</button>
                        </div>
                    `;
                    startTimer();

                    document.getElementById('timer-toggle-btn').addEventListener('click', (e) => {
                        const btn = e.target;
                        if (btn.textContent === 'Pause') {
                            stopTimer();
                            btn.textContent = 'Resume';
                            btn.classList.remove('btn-warning');
                            btn.classList.add('btn-success');
                        } else {
                            startTimer();
                            btn.textContent = 'Pause';
                            btn.classList.remove('btn-success');
                            btn.classList.add('btn-warning');
                        }
                    });
                });
            }
        } else {
            document.getElementById('delete-session-btn').classList.add('d-none');
            const today = new Date();
            sessionDate.textContent = `Workout Session - ${formatDate(today)}`;
            timerContainer.innerHTML = `
                <div class="d-flex flex-column flex-md-row align-items-center">
                    <span id="timer-display" class="badge bg-success fs-5 mb-1 mb-md-0 me-md-2">00:00:00</span>
                    <button type="button" id="timer-toggle-btn" class="btn btn-sm btn-warning">Pause</button>
                </div>
            `;
            resetTimer();
            startTimer();

            document.getElementById('timer-toggle-btn').addEventListener('click', (e) => {
                const btn = e.target;
                if (btn.textContent === 'Pause') {
                    stopTimer();
                    btn.textContent = 'Resume';
                    btn.classList.remove('btn-warning');
                    btn.classList.add('btn-success');
                } else {
                    startTimer();
                    btn.textContent = 'Pause';
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-warning');
                }
            });
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
            // When editing an existing session, exclude the current session to find the actual previous workout
            let lastSessionQuery = supabaseClient
                .from('workout_sessions')
                .select('id, date, sets!inner(exercise_id)')
                .eq('sets.exercise_id', exercise.id);
            
            if (sessionId) {
                lastSessionQuery = lastSessionQuery.neq('id', sessionId);
            }
            
            const { data: lastSessionWithExercise, error: lastSessionError } = await lastSessionQuery
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
                
                // First, add the sets that were actually performed in this session
                setsToLoad.forEach(s => {
                    setsHtml += `
                        <div class="set mt-2 position-relative">
                            <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="${s.weight || 'kg'}" value="${s.weight || ''}">
                            <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="${s.reps || 'reps'}" value="${s.reps || ''}">
                        </div>
                    `;
                });

                // Then, if fewer sets were done than the last time, add the remainder as placeholders
                if (setsForPlaceholders.length > setsToLoad.length) {
                    const remainingSets = setsForPlaceholders.slice(setsToLoad.length);
                    remainingSets.forEach(s => {
                        setsHtml += `
                            <div class="set mt-2 position-relative">
                                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="${s.weight || 'kg'}">
                                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="${s.reps || 'reps'}">
                            </div>
                        `;
                    });
                } else if (setsToLoad.length === 0 && setsForPlaceholders.length > 0) {
                    // If the exercise was SKIPPED in this session, use placeholders from the last performance
                    setsForPlaceholders.forEach(s => {
                        setsHtml += `
                            <div class="set mt-2 position-relative">
                                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="${s.weight || 'kg'}">
                                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="${s.reps || 'reps'}">
                            </div>
                        `;
                    });
                }

            } else { // Starting a new session, use placeholders from the last performance
                if (setsForPlaceholders.length > 0) {
                    setsForPlaceholders.forEach(s => {
                        setsHtml += `
                            <div class="set mt-2 position-relative">
                                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="${s.weight || 'kg'}">
                                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="${s.reps || 'reps'}">
                            </div>
                        `;
                    });
                }
            }

            // If no sets were found for either case, default to one empty set
            if (setsHtml === '') {
                setsHtml = `
                    <div class="set mt-2 position-relative">
                        <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="kg">
                        <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="reps">
                    </div>
                `;
            }

            row.innerHTML = `
                <td data-label="Exercise">${exercise.name} <span class="badge bg-secondary">${exercise.muscle_group}</span></td>
                <td data-label="Sets (Weight x Reps)" class="sets-container">${setsHtml}</td>
                <td data-label="Volume (kg)" class="volume"><span class="badge bg-primary volume-badge">0</span></td>
                <td data-label="Previous Volume" class="previous-volume">${previousVolume > 0 ? `<span class="badge bg-danger volume-badge">${previousVolume.toFixed(1)}</span> - ${previousDate}` : 'N/A'}</td>
                <td data-label="Change vs. Last" class="change">N/A</td>
                <td data-label="Actions">
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
        const { data, error } = await supabaseClient
            .from('exercises')
            .select('*')
            .eq('is_in_routine', true)
            .order('ordering');
        if (error) {
            console.error('Error fetching exercises:', error);
            return [];
        }
        return data;
    }

    async function getAllExercises() {
        const { data, error } = await supabaseClient
            .from('exercises')
            .select('*')
            .order('name');
        if (error) {
            console.error('Error fetching all exercises:', error);
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
            firstDay: 1, // Start week on Monday
            events: events,
            eventClick: function(info) {
                const sessionId = info.event.extendedProps.sessionId;
                startWorkoutSession(sessionId);
            },
            eventColor: '#198754',
            aspectRatio: 1.8
        });

        calendar.render();
    }

    workoutTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-set-btn')) {
            const setsContainer = e.target.closest('tr').querySelector('.sets-container');
            const newSet = document.createElement('div');
            newSet.className = 'set mt-2 position-relative';
            const lastWeightPlaceholder = setsContainer.querySelector('.weight-input:last-of-type')?.placeholder || 'kg';
            const lastRepsPlaceholder = setsContainer.querySelector('.reps-input:last-of-type')?.placeholder || 'reps';
            newSet.innerHTML = `
                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="${lastWeightPlaceholder}">
                <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="${lastRepsPlaceholder}">
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

            const setElement = e.target.closest('.set');
            const weightInput = setElement.querySelector('.weight-input');
            const repsInput = setElement.querySelector('.reps-input');

            if (weightInput.value && repsInput.value) {
                startRestTimer(setElement);
            }
        }
    });

    async function startRestTimer(setElement) {
        const { data: settings, error } = await supabaseClient
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.error('Error fetching settings:', error);
            return;
        }

        // Clear any existing timer for this set
        const existingTimer = setElement.querySelector('.rest-timer');
        if (existingTimer) {
            clearInterval(existingTimer.intervalId);
            existingTimer.remove();
        }

        const timerBadge = document.createElement('span');
        timerBadge.className = 'badge bg-info rest-timer';
        timerBadge.style.position = 'absolute';
        timerBadge.style.top = '-10px';
        timerBadge.style.left = '0px';
        
        let timeLeft = settings.rest_timer_duration;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerBadge.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        setElement.appendChild(timerBadge);

        const intervalId = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerBadge.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(intervalId);
                timerBadge.remove();
                if (settings.play_sound_on_timer_end) {
                    timerSound.currentTime = 0; // Rewind to the start
                    timerSound.play().catch(error => console.error("Audio playback failed:", error));
                }
            }
        }, 1000);

        timerBadge.intervalId = intervalId;
    }

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
                        prBadge.style.right = '0px';
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

    const saveConfirmationModal = new bootstrap.Modal(document.getElementById('saveConfirmationModal'));
    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    const addExerciseModal = new bootstrap.Modal(document.getElementById('addExerciseModal'));
    const existingExerciseSelect = document.getElementById('existing-exercise-select');
    const addSelectedExerciseBtn = document.getElementById('add-selected-exercise-btn');
    const createNewExerciseBtn = document.getElementById('create-new-exercise-btn');
    const deleteSessionBtn = document.getElementById('delete-session-btn');
    const deleteConfirmationModal = new bootstrap.Modal(document.getElementById('deleteConfirmationModal'));
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    deleteSessionBtn.addEventListener('click', () => {
        deleteConfirmationModal.show();
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        const sessionId = workoutForm.dataset.sessionId;
        if (!sessionId) return;

        // First, delete all sets associated with the session
        const { error: setsError } = await supabaseClient
            .from('sets')
            .delete()
            .eq('workout_session_id', sessionId);

        if (setsError) {
            console.error('Error deleting sets:', setsError);
            alert('Failed to delete workout sets.');
            return;
        }

        // Then, delete the session itself
        const { error: sessionError } = await supabaseClient
            .from('workout_sessions')
            .delete()
            .eq('id', sessionId);

        if (sessionError) {
            console.error('Error deleting session:', sessionError);
            alert('Failed to delete workout session.');
            return;
        }

        alert('Workout session deleted successfully!');
        window.location.href = 'index.html';
    });

    workoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveConfirmationModal.show();
    });

    confirmSaveBtn.addEventListener('click', async () => {
        saveConfirmationModal.hide();
        let sessionId = workoutForm.dataset.sessionId;
        stopTimer(); // Stop timer for both new and continued sessions

        // If it's a new session, create it first
        if (!sessionId) {
            const localDate = new Date();
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            const { data: sessionData, error: sessionError } = await supabaseClient
                .from('workout_sessions')
                .insert({ date: today, duration: timerSeconds })
                .select('id')
                .single();

            if (sessionError) {
                console.error('Error creating session:', sessionError);
                alert('Failed to save session.');
                return;
            }
            sessionId = sessionData.id;
        } else {
            // If we are editing an existing session, update its duration and delete its old sets
            const { error: updateError } = await supabaseClient
                .from('workout_sessions')
                .update({ duration: timerSeconds })
                .eq('id', sessionId);

            if (updateError) {
                console.error('Error updating session duration:', updateError);
                alert('Failed to update session duration.');
                // We can still proceed to save the sets
            }

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
        window.location.reload();
    });

    async function populateAddExerciseModal() {
        const exercises = await getExercises();
        const currentlyDisplayed = Array.from(workoutTableBody.querySelectorAll('tr')).map(tr => tr.dataset.exerciseName);
        
        existingExerciseSelect.innerHTML = '<option selected disabled>Select an exercise...</option>'; // Reset
        exercises.forEach(ex => {
            if (!currentlyDisplayed.includes(ex.name)) {
                const option = document.createElement('option');
                option.value = ex.id;
                option.textContent = ex.name;
                existingExerciseSelect.appendChild(option);
            }
        });
    }

    document.getElementById('add-exercise-btn').addEventListener('click', async () => {
        await populateAddExerciseModal();
        addExerciseModal.show();
    });

    addSelectedExerciseBtn.addEventListener('click', async () => {
        const selectedId = parseInt(existingExerciseSelect.value);
        if (isNaN(selectedId)) {
            alert('Please select an exercise.');
            return;
        }
        const { data: exercise } = await supabaseClient.from('exercises').select('*').eq('id', selectedId).single();
        if (exercise) {
            await addExerciseRowToTable(exercise);
            addExerciseModal.hide();
        }
    });

    createNewExerciseBtn.addEventListener('click', async () => {
        const newExerciseName = document.getElementById('new-exercise-name').value.trim();
        const newExerciseGroup = document.getElementById('new-exercise-group').value;

        if (!newExerciseName || !newExerciseGroup) {
            alert('Please provide a name and muscle group for the new exercise.');
            return;
        }

        const { data, error } = await supabaseClient
            .from('exercises')
            .insert({ name: newExerciseName, muscle_group: newExerciseGroup })
            .select()
            .single();

        if (error) {
            console.error('Error creating new exercise:', error);
            alert('Failed to create exercise. It might already exist.');
            return;
        }

        await addExerciseRowToTable(data);
        addExerciseModal.hide();
        document.getElementById('new-exercise-name').value = '';
        document.getElementById('new-exercise-group').value = 'Select a muscle group...';
    });

    async function addExerciseRowToTable(exercise) {
        const row = document.createElement('tr');
        row.dataset.exerciseId = exercise.id;
        row.dataset.exerciseName = exercise.name;

        // --- Fetch Previous Volume Logic (mirrors populateWorkoutTable) ---
        // When adding an exercise during editing, exclude the current session to find the actual previous workout
        const sessionId = workoutForm.dataset.sessionId;
        let previousVolume = 0;
        let previousDate = 'N/A';
        let setsInLastSession = [];
        
        let lastSessionQuery = supabaseClient
            .from('workout_sessions')
            .select('id, date, sets!inner(exercise_id)')
            .eq('sets.exercise_id', exercise.id);
        
        if (sessionId) {
            lastSessionQuery = lastSessionQuery.neq('id', sessionId);
        }
        
        const { data: lastSessionWithExercise } = await lastSessionQuery
            .order('date', { ascending: false })
            .limit(1)
            .single();

        if (lastSessionWithExercise) {
            previousDate = formatShortDate(lastSessionWithExercise.date);
            const { data: fetchedSets } = await supabaseClient
                .from('sets')
                .select('weight, reps, volume')
                .eq('workout_session_id', lastSessionWithExercise.id)
                .eq('exercise_id', exercise.id);

            if (fetchedSets) {
                previousVolume = fetchedSets.reduce((sum, set) => sum + (set.volume || 0), 0);
                setsInLastSession = fetchedSets;
            }
        }
        row.dataset.lastVolume = previousVolume;
        // --- End of Fetch Logic ---

        let setsHtml = '';
        if (setsInLastSession && setsInLastSession.length > 0) {
            setsInLastSession.forEach(s => {
                setsHtml += `
                    <div class="set mt-2 position-relative">
                        <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="${s.weight || 'kg'}">
                        <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="${s.reps || 'reps'}">
                    </div>
                `;
            });
        } else {
            setsHtml = `
                <div class="set mt-2 position-relative">
                    <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input weight-input" placeholder="kg">
                    <input type="number" inputmode="decimal" pattern="[0-9]*" class="form-control d-inline-block set-input reps-input" placeholder="reps">
                </div>
            `;
        }

        row.innerHTML = `
            <td data-label="Exercise">${exercise.name} <span class="badge bg-secondary">${exercise.muscle_group}</span></td>
            <td data-label="Sets (Weight x Reps)" class="sets-container">${setsHtml}</td>
            <td data-label="Volume (kg)" class="volume"><span class="badge bg-primary volume-badge">0</span></td>
            <td data-label="Previous Volume" class="previous-volume">${previousVolume > 0 ? `<span class="badge bg-danger volume-badge">${previousVolume.toFixed(1)}</span> - ${previousDate}` : 'N/A'}</td>
            <td data-label="Change vs. Last" class="change">N/A</td>
            <td data-label="Actions">
                <button type="button" class="btn btn-sm btn-info add-set-btn">Add Set</button>
                <button type="button" class="btn btn-sm btn-danger delete-set-btn mt-1">Delete Set</button>
                <button type="button" class="btn btn-sm btn-warning delete-exercise-btn mt-1">Delete Exercise</button>
            </td>
        `;
        workoutTableBody.appendChild(row);
        calculateVolume(row); // Calculate initial volume and change
    }

    let overallVolumeChart = null;
    let exerciseProgressChart = null;
    let muscleGroupChart = null;
    let durationChart = null;

    async function loadDashboardCharts() {
        const { data, error } = await supabaseClient
            .from('workout_sessions')
            .select('date, duration, sets(*, exercises(id, name, muscle_group))')
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

        // Process data for duration chart
        const durationCtx = document.getElementById('durationChart').getContext('2d');
        if (durationChart) durationChart.destroy();
        durationChart = new Chart(durationCtx, {
            type: 'line',
            data: {
                labels: data.map(s => formatDate(s.date)),
                datasets: [{
                    label: 'Workout Duration (minutes)',
                    data: data.map(s => s.duration / 60), // Convert seconds to minutes
                    borderColor: 'rgba(255, 159, 64, 1)',
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

        // Calculate workouts this year
        const startOfYear = new Date(todayForWeek.getFullYear(), 0, 1);
        let workoutsThisYear = 0;
        workoutDates.forEach(dateStr => {
            if (new Date(dateStr) >= startOfYear) {
                workoutsThisYear++;
            }
        });

        streakContainer.innerHTML = `
            <span class="badge bg-warning text-dark fs-5 mb-1 d-block">
                🔥 ${streak} Day Streak
            </span>
            <span class="badge bg-info text-dark fs-5 d-block mb-1">
                💪 ${workoutsThisWeek} Workouts This Week
            </span>
            <span class="badge bg-success text-white fs-5 d-block mb-1">
                🗓️ ${workoutsThisMonth} Workouts This Month
            </span>
            <span class="badge bg-primary text-white fs-5 d-block">
                🎉 ${workoutsThisYear} Workouts This Year
            </span>
        `;
    }

    async function loadPersonalRecords() {
        const prList = document.getElementById('pr-list');
        prList.innerHTML = ''; // Clear existing PRs

        const exercises = await getAllExercises();
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
                    muscleGroup: exercise.muscle_group,
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
                <span>${pr.exerciseName} <span class="badge bg-secondary">${pr.muscleGroup}</span></span>
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
