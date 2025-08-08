// /admin/js/quiz-sets.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const setsList = document.getElementById('sets-list');
    const modal = document.getElementById('set-modal');
    const modalTitle = document.getElementById('modal-title');
    const setForm = document.getElementById('set-form');
    const addSetBtn = document.getElementById('add-set-btn');
    const closeModalBtn = modal.querySelector('.close-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const questionSelectionList = document.getElementById('question-selection-list');
    const selectedCountSpan = document.getElementById('selected-count');
    const questionSearchInput = document.getElementById('question-search');
    const topicFilterSelect = document.getElementById('topic-filter'); // Element mới

    let allQuestions = [];

    const closeModal = () => modal.style.display = 'none';
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    const fetchAllQuestions = async () => {
        if (allQuestions.length > 0) return;
        try {
            const snapshot = await db.collection('questions').orderBy('timestamp', 'desc').get();
            allQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateTopicFilter(); // Gọi sau khi đã có dữ liệu
        } catch (error) {
            console.error("Error fetching questions: ", error);
        }
    };

    const populateTopicFilter = () => {
        const topics = [...new Set(allQuestions.map(q => q.topic).filter(Boolean))];
        topicFilterSelect.innerHTML = '<option value="">-- Tất cả chủ đề --</option>';
        topics.sort().forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic;
            topicFilterSelect.appendChild(option);
        });
    };

    const renderQuestionSelection = (selectedIds = [], searchTerm = '', topicFilter = '') => {
        questionSelectionList.innerHTML = '';
        const filteredQuestions = allQuestions.filter(q => {
            const topicMatch = !topicFilter || q.topic === topicFilter;
            const searchMatch = !searchTerm || q.text.toLowerCase().includes(searchTerm.toLowerCase());
            return topicMatch && searchMatch;
        });

        if (filteredQuestions.length === 0) {
            questionSelectionList.innerHTML = '<p>Không tìm thấy câu hỏi nào phù hợp.</p>';
            return;
        }

        filteredQuestions.forEach(q => {
            const isChecked = selectedIds.includes(q.id);
            const label = document.createElement('label');
            // HIỂN THỊ CHỦ ĐỀ KHI CHỌN
            label.innerHTML = `
                <input type="checkbox" value="${q.id}" ${isChecked ? 'checked' : ''}>
                <span>${q.text.substring(0, 80)}${q.text.length > 80 ? '...' : ''}</span>
                <span class="question-topic">${q.topic || 'N/A'}</span>
            `;
            questionSelectionList.appendChild(label);
        });
        updateSelectedCount();
    };
    
    const updateSelectedCount = () => {
        const count = questionSelectionList.querySelectorAll('input[type="checkbox"]:checked').length;
        selectedCountSpan.textContent = count;
    };
    
    questionSelectionList.addEventListener('change', updateSelectedCount);

    const applyFilters = () => {
        const selectedIds = Array.from(questionSelectionList.querySelectorAll('input:checked')).map(cb => cb.value);
        const searchTerm = questionSearchInput.value;
        const topicFilter = topicFilterSelect.value;
        renderQuestionSelection(selectedIds, searchTerm, topicFilter);
    };
    topicFilterSelect.addEventListener('change', applyFilters);
    questionSearchInput.addEventListener('input', applyFilters);

    const openSetModal = async (doc = null) => {
        setForm.reset();
        topicFilterSelect.value = '';
        await fetchAllQuestions();
        let selectedIds = [];

        if (doc) {
            const setData = doc.data();
            modalTitle.textContent = 'Sửa bộ đề';
            document.getElementById('set-id').value = doc.id;
            document.getElementById('set-name').value = setData.name;
            document.getElementById('set-description').value = setData.description || '';
            selectedIds = setData.questionIds || [];
        } else {
            modalTitle.textContent = 'Tạo bộ đề mới';
            document.getElementById('set-id').value = '';
        }
        renderQuestionSelection(selectedIds, '', '');
        modal.style.display = 'block';
    };

    addSetBtn.addEventListener('click', () => openSetModal());

    setForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const setName = document.getElementById('set-name').value.trim();
        if (!setName) { alert('Vui lòng nhập tên bộ đề.'); return; }
        const selectedIds = Array.from(questionSelectionList.querySelectorAll('input:checked')).map(cb => cb.value);
        if (selectedIds.length === 0) { alert('Vui lòng chọn ít nhất một câu hỏi cho bộ đề.'); return; }

        const setId = document.getElementById('set-id').value;
        const setData = {
            name: setName,
            description: document.getElementById('set-description').value.trim(),
            questionIds: selectedIds,
        };
        try {
            if (setId) {
                await db.collection('quiz_sets').doc(setId).update(setData);
            } else {
                setData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('quiz_sets').add(setData);
            }
            closeModal();
        } catch (error) {
            console.error("Error saving quiz set: ", error);
        }
    });
    
    db.collection('quiz_sets').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        setsList.innerHTML = '';
        if (snapshot.empty) {
            setsList.innerHTML = '<tr><td colspan="4">Chưa có bộ đề nào.</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const setData = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${setData.name}</td><td>${(setData.questionIds || []).length}</td><td>${setData.createdAt ? setData.createdAt.toDate().toLocaleDateString('vi-VN') : 'N/A'}</td><td><button class="btn btn-warning edit-btn">Sửa</button><button class="btn btn-danger delete-btn">Xóa</button></td>`;
            setsList.appendChild(tr);
            tr.querySelector('.edit-btn').addEventListener('click', () => openSetModal(doc));
            tr.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm(`Xóa bộ đề "${setData.name}"?`)) {
                    await db.collection('quiz_sets').doc(doc.id).delete();
                }
            });
        });
    });
});