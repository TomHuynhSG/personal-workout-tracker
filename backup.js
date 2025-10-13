document.addEventListener('DOMContentLoaded', () => {
    const backupBtn = document.getElementById('backup-btn');
    const restoreBtn = document.getElementById('restore-btn');
    const restoreFileInput = document.getElementById('restore-file');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    // --- Theme Toggle Logic ---
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

    // Apply saved theme on load
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // --- Backup Logic ---
    backupBtn.addEventListener('click', async () => {
        try {
            backupBtn.disabled = true;
            backupBtn.textContent = 'Backing up...';

            const { data: exercises } = await supabaseClient.from('exercises').select('*');
            const { data: workout_sessions } = await supabaseClient.from('workout_sessions').select('*');
            const { data: sets } = await supabaseClient.from('sets').select('*');
            const { data: settings } = await supabaseClient.from('settings').select('*');

            const backupData = {
                exercises,
                workout_sessions,
                sets,
                settings,
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
            a.download = `workout-backup-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('Backup successful!');
        } catch (error) {
            console.error('Backup failed:', error);
            alert('Backup failed. Check the console for details.');
        } finally {
            backupBtn.disabled = false;
            backupBtn.textContent = 'Backup Data';
        }
    });

    // --- Restore Logic ---
    restoreFileInput.addEventListener('change', () => {
        restoreBtn.disabled = !restoreFileInput.files.length;
    });

    restoreBtn.addEventListener('click', async () => {
        const file = restoreFileInput.files[0];
        if (!file) {
            alert('Please select a backup file first.');
            return;
        }

        const confirmation = prompt("Type 'RESTORE' to confirm. This will completely wipe all existing data.");
        if (confirmation !== 'RESTORE') {
            alert('Restore cancelled.');
            return;
        }

        try {
            restoreBtn.disabled = true;
            restoreBtn.textContent = 'Restoring...';

            const fileContent = await file.text();
            const backupData = JSON.parse(fileContent);

            if (!backupData.exercises || !backupData.workout_sessions || !backupData.sets) {
                throw new Error('Invalid backup file structure.');
            }

            // 1. Clear existing data in reverse order of dependency
            await supabaseClient.from('sets').delete().neq('id', 0);
            await supabaseClient.from('workout_sessions').delete().neq('id', 0);
            await supabaseClient.from('exercises').delete().neq('id', 0);
            await supabaseClient.from('settings').delete().neq('id', 0);

            // 2. Restore settings
            if (backupData.settings && backupData.settings.length > 0) {
                const { error: settingsError } = await supabaseClient.from('settings').insert(backupData.settings);
                if (settingsError) throw settingsError;
            }

            // 3. Restore exercises and create an ID map { oldId: newId }
            const oldExerciseIdMap = {};
            const sanitizedExercises = backupData.exercises.map(({ id, created_at, ...rest }, index) => ({
                ...rest,
                is_in_routine: rest.is_in_routine !== undefined ? rest.is_in_routine : true,
                ordering: rest.ordering !== undefined ? rest.ordering : index
            }));
            const { data: newExercises, error: exercisesError } = await supabaseClient
                .from('exercises')
                .insert(sanitizedExercises)
                .select('id, name');
            if (exercisesError) throw exercisesError;

            backupData.exercises.forEach(oldExercise => {
                const newExercise = newExercises.find(ex => ex.name === oldExercise.name);
                if (newExercise) {
                    oldExerciseIdMap[oldExercise.id] = newExercise.id;
                }
            });

            // 3. Restore sessions and create an ID map { oldId: newId }
            const oldSessionIdMap = {};
            const sanitizedSessions = backupData.workout_sessions.map(({ id, created_at, ...rest }) => ({
                ...rest,
                duration: rest.duration || null // Ensure duration is null if not present
            }));
            const { data: newSessions, error: sessionsError } = await supabaseClient
                .from('workout_sessions')
                .insert(sanitizedSessions)
                .select('id, date');
            if (sessionsError) throw sessionsError;
            
            // This mapping assumes dates are unique. A more complex backup would need better unique identifiers.
            backupData.workout_sessions.forEach(oldSession => {
                const newSession = newSessions.find(s => s.date === oldSession.date);
                if (newSession) {
                    oldSessionIdMap[oldSession.id] = newSession.id;
                }
            });

            // 4. Remap and restore sets
            const remappedSets = backupData.sets.map(({ id, created_at, volume, workout_session_id, exercise_id, ...rest }) => ({
                ...rest,
                workout_session_id: oldSessionIdMap[workout_session_id],
                exercise_id: oldExerciseIdMap[exercise_id]
            }));

            const validSets = remappedSets.filter(s => s.workout_session_id && s.exercise_id);
            const { error: setsError } = await supabaseClient.from('sets').insert(validSets);
            if (setsError) throw setsError;

            alert('Restore successful! The application will now reload.');
            window.location.reload();

        } catch (error) {
            console.error('Restore failed:', error);
            alert(`Restore failed: ${error.message}. Data may be in an inconsistent state.`);
        } finally {
            restoreBtn.disabled = false;
            restoreBtn.textContent = 'Restore Data';
        }
    });
});
