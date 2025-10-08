document.addEventListener('DOMContentLoaded', () => {
    const routineList = document.getElementById('routine-exercises-list');
    const availableList = document.getElementById('available-exercises-list');
    const allExercisesList = document.getElementById('all-exercises-list');
    const addToRoutineBtn = document.getElementById('add-to-routine-btn');
    const removeFromRoutineBtn = document.getElementById('remove-from-routine-btn');
    const createExerciseBtn = document.getElementById('create-exercise-master-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const moveUpBtn = document.getElementById('move-up-btn');
    const moveDownBtn = document.getElementById('move-down-btn');

    let selectedRoutineItem = null;
    let selectedAvailableItem = null;

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

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // --- Main Data Loading ---
    async function loadAllExercises() {
        const { data: exercises, error } = await supabaseClient.from('exercises').select('*').order('ordering');
        if (error) {
            console.error('Error fetching exercises:', error);
            return;
        }

        routineList.innerHTML = '';
        availableList.innerHTML = '';
        allExercisesList.innerHTML = '';

        exercises.forEach(ex => {
            // Populate Routine Management lists
            const listItemRoutine = document.createElement('li');
            listItemRoutine.className = 'list-group-item';
            listItemRoutine.innerHTML = `${ex.name} <span class="badge bg-secondary">${ex.muscle_group}</span>`;
            listItemRoutine.dataset.id = ex.id;
            if (ex.is_in_routine) {
                routineList.appendChild(listItemRoutine);
            } else {
                availableList.appendChild(listItemRoutine);
            }

            // Populate Master CRUD list
            const listItemMaster = document.createElement('li');
            listItemMaster.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItemMaster.innerHTML = `
                <span>${ex.name} <span class="badge bg-secondary">${ex.muscle_group}</span></span>
                <div>
                    <button class="btn btn-sm btn-outline-primary edit-btn">Edit</button>
                    <button class="btn btn-sm btn-outline-danger delete-btn">Delete</button>
                </div>
            `;
            listItemMaster.dataset.id = ex.id;
            listItemMaster.dataset.name = ex.name;
            listItemMaster.dataset.group = ex.muscle_group;
            allExercisesList.appendChild(listItemMaster);
        });
    }

    // --- Routine Management Logic ---
    routineList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            if (selectedRoutineItem) selectedRoutineItem.classList.remove('active');
            selectedRoutineItem = e.target;
            selectedRoutineItem.classList.add('active');
            if (selectedAvailableItem) selectedAvailableItem.classList.remove('active');
            selectedAvailableItem = null;
        }
    });

    availableList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            if (selectedAvailableItem) selectedAvailableItem.classList.remove('active');
            selectedAvailableItem = e.target;
            selectedAvailableItem.classList.add('active');
            if (selectedRoutineItem) selectedRoutineItem.classList.remove('active');
            selectedRoutineItem = null;
        }
    });

    removeFromRoutineBtn.addEventListener('click', async () => {
        if (!selectedRoutineItem) return;
        const id = selectedRoutineItem.dataset.id;
        const { error } = await supabaseClient.from('exercises').update({ is_in_routine: false }).eq('id', id);
        if (error) console.error('Error updating routine:', error);
        else {
            availableList.appendChild(selectedRoutineItem);
            selectedRoutineItem.classList.remove('active');
            selectedRoutineItem = null;
        }
    });

    addToRoutineBtn.addEventListener('click', async () => {
        if (!selectedAvailableItem) return;
        const id = selectedAvailableItem.dataset.id;
        const { error } = await supabaseClient.from('exercises').update({ is_in_routine: true }).eq('id', id);
        if (error) console.error('Error updating routine:', error);
        else {
            routineList.appendChild(selectedAvailableItem);
            selectedAvailableItem.classList.remove('active');
            selectedAvailableItem = null;
        }
    });

    moveUpBtn.addEventListener('click', () => moveItem(-1));
    moveDownBtn.addEventListener('click', () => moveItem(1));

    async function moveItem(direction) {
        if (!selectedRoutineItem) return;

        const items = Array.from(routineList.children);
        const currentIndex = items.findIndex(item => item === selectedRoutineItem);
        const newIndex = currentIndex + direction;

        if (newIndex < 0 || newIndex >= items.length) return; // Can't move outside bounds

        // Swap in the DOM
        if (direction === -1) { // Move Up
            routineList.insertBefore(selectedRoutineItem, items[newIndex]);
        } else { // Move Down
            routineList.insertBefore(selectedRoutineItem, items[newIndex + 1]);
        }

        // Update ordering in the database
        const updatedOrder = Array.from(routineList.children).map((item, index) => {
            return supabaseClient
                .from('exercises')
                .update({ ordering: index })
                .eq('id', item.dataset.id);
        });

        const { error } = await Promise.all(updatedOrder);
        if (error) console.error('Error reordering:', error);
    }


    // --- Master CRUD Logic ---
    createExerciseBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('new-exercise-name-master');
        const groupInput = document.getElementById('new-exercise-group-master');
        const name = nameInput.value.trim();
        const group = groupInput.value;

        if (!name || group === 'Choose Muscle Group...') {
            alert('Please provide a name and muscle group.');
            return;
        }

        const { error } = await supabaseClient.from('exercises').insert({ name, muscle_group: group, is_in_routine: false });
        if (error) {
            alert('Error creating exercise. It might already exist.');
            console.error(error);
        } else {
            nameInput.value = '';
            groupInput.value = 'Choose Muscle Group...';
            loadAllExercises();
        }
    });

    allExercisesList.addEventListener('click', async (e) => {
        const target = e.target;
        const listItem = target.closest('li');
        const id = listItem.dataset.id;

        if (target.classList.contains('delete-btn')) {
            if (confirm(`Are you sure you want to permanently delete "${listItem.dataset.name}"? This will also delete all associated workout data.`)) {
                const { error } = await supabaseClient.from('exercises').delete().eq('id', id);
                if (error) {
                    alert('Error deleting exercise.');
                    console.error(error);
                } else {
                    loadAllExercises();
                }
            }
        }

        if (target.classList.contains('edit-btn')) {
            const currentName = listItem.dataset.name;
            const currentGroup = listItem.dataset.group;
            const newName = prompt('Enter new exercise name:', currentName);
            
            if (newName && newName.trim() !== '') {
                const { error } = await supabaseClient.from('exercises').update({ name: newName.trim() }).eq('id', id);
                if (error) {
                    alert('Error updating exercise.');
                    console.error(error);
                } else {
                    loadAllExercises();
                }
            }
        }
    });

    // Initial Load
    loadAllExercises();
});
