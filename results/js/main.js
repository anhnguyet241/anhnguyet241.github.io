// /results/js/main.js - Thay thế toàn bộ
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const searchNameInput = document.getElementById('search-name');
    const searchBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('results-history-container');

    // Modal elements
    const detailModal = document.getElementById('result-detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const detailQuizInfo = document.getElementById('detail-quiz-info');
    const detailAnswersContainer = document.getElementById('detail-answers-container');
    const closeModalButtons = detailModal.querySelectorAll('.close-btn, .close-modal-btn');

    // --- Modal Control Functions ---
    const openModal = () => detailModal.style.display = 'block';
    const closeModal = () => detailModal.style.display = 'none';

    closeModalButtons.forEach(btn => btn.addEventListener('click', closeModal));
    window.addEventListener('click', (event) => {
        if (event.target === detailModal) closeModal();
    });

    // --- Search & Display Results List ---
    const searchResults = async () => {
        const name = searchNameInput.value.trim();
        if (!name) {
            alert('Enter u name.');
            return;
        }

        resultsContainer.innerHTML = '<p>searching...</p>';

        try {
            const snapshot = await db.collection('results')
                .where('name', '==', name)
                .orderBy('timestamp', 'desc')
                .get();
            
            if (snapshot.empty) {
                resultsContainer.innerHTML = '<p>No result.</p>';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.timestamp.toDate().toLocaleString('vi-VN');
                
                let scoreDisplay = '';
                let statusDisplay = '';

                if (data.status === 'graded') {
                    const score = data.finalScore !== null ? data.finalScore : data.autoGradedScore;
                    scoreDisplay = `Last Score: <strong>${score}</strong>`;
                    statusDisplay = `<span class="status-graded">Complete</span>`;
                } else if (data.status === 'pending_grading') {
                    scoreDisplay = `Last Score: <strong>${data.autoGradedScore}/${data.maxAutoGradedScore}</strong>`;
                    statusDisplay = `<span class="status-pending">Pending</span>`;
                }

                html += `
                    <div class="result-card">
                        <div class="result-card-info">
                            <h4>${data.quizSetName || 'Bài thi ngẫu nhiên'}</h4>
                            <p>${scoreDisplay}</p>
                            <p>Status: ${statusDisplay}</p>
                            <p><small>Date & time: ${date}</small></p>
                        </div>
                        <button class="btn btn-primary view-detail-btn" data-doc-id="${doc.id}">Review</button>
                    </div>
                `;
            });
            resultsContainer.innerHTML = html;

            // Add event listeners to "Xem chi tiết" buttons
            document.querySelectorAll('.view-detail-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const docId = e.target.dataset.docId;
                    await displayResultDetails(docId);
                });
            });

        } catch (error) {
            console.error("Lỗi khi tìm kết quả: ", error);
            if (error.code === 'failed-precondition') {
                resultsContainer.innerHTML = '<p>Lỗi: Cần tạo Index trong Firestore. Hãy vào Firebase Console, tìm lỗi và nhấp vào link để tạo Index cho collection `results` theo `name` và `timestamp`.</p>';
            } else {
                 resultsContainer.innerHTML = '<p>Đã xảy ra lỗi khi tải kết quả.</p>';
            }
        }
    };

    searchBtn.addEventListener('click', searchResults);
    searchNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchResults();
        }
    });

    // --- Display Result Details in Modal ---
    const displayResultDetails = async (docId) => {
        try {
            const doc = await db.collection('results').doc(docId).get();
            if (!doc.exists) {
                alert('Không tìm thấy bài làm này.');
                return;
            }
            const data = doc.data();

            modalTitle.textContent = `Review : ${data.quizSetName || 'Bài thi ngẫu nhiên'}`;
            detailQuizInfo.innerHTML = `
                <p><strong>Name:</strong> ${data.name}</p>
                <p><strong>Time:</strong> ${Math.floor(data.timeTaken / 60)} minute ${data.timeTaken % 60} second</p>
                <p><strong>Date & time:</strong> ${data.timestamp.toDate().toLocaleString('vi-VN')}</p>
                <p><strong>Score:</strong> ${data.status === 'graded' ? (data.finalScore !== null ? data.finalScore : 'Complete') : `${data.autoGradedScore}/${data.maxAutoGradedScore} (pending)`}</p>
            `;

            let answersHtml = '';
            data.answers.forEach((answer, index) => {
                answersHtml += `<div class="review-item">`;
                answersHtml += `<p><strong>No ${index + 1} (${answer.questionType}):</strong> ${answer.questionText}</p>`;
                
                switch (answer.questionType) {
                    case 'multiple-choice':
                        const isCorrectMC = answer.userAnswer === answer.correctAnswer;
                        answersHtml += `<div class="${isCorrectMC ? 'correct' : 'incorrect'}">
                                          <div><strong>You choose:</strong> ${answer.options[answer.userAnswer] || 'Chưa trả lời'} (${answer.userAnswer || 'N/A'})</div>
                                          ${!isCorrectMC ? `<div class="highlight-correct"><strong>corect answer:</strong> ${answer.options[answer.correctAnswer]} (${answer.correctAnswer})</div>` : ''}
                                       </div>`;
                        break;
                    case 'matching':
                        let isAllCorrectMatching = true;
                        let matchingReview = '<ul>';
                        for (const prompt in answer.correctAnswer) {
                            const userAns = answer.userAnswer ? answer.userAnswer[prompt] : 'N/A';
                            const correctAns = answer.correctAnswer[prompt];
                            const isPairCorrect = userAns === correctAns;
                            if (!isPairCorrect) isAllCorrectMatching = false;
                            matchingReview += `<li class="${isPairCorrect ? 'text-success' : 'text-danger'}">${prompt} ↔️ ${userAns} ${!isPairCorrect ? `(Đúng: ${correctAns})` : ''}</li>`;
                        }
                        matchingReview += '</ul>';
                        answersHtml += `<div class="${isAllCorrectMatching ? 'correct' : 'incorrect'}"><strong>Câu trả lời:</strong> ${matchingReview}</div>`;
                        break;
                    case 'essay':
                        answersHtml += `
                            <div style="background-color: #f0f8ff; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                                <p><strong>Your test:</strong></p>
                                <p style="white-space: pre-wrap;">${answer.userAnswer || 'Chưa trả lời'}</p>
                            </div>
                            ${data.status === 'graded' && answer.gradedPoints !== null ? `<p><strong>Last Score:</strong> ${answer.gradedPoints}/${answer.maxPoints}</p>` : ''}
                        `;
                        break;
                }
                answersHtml += `</div>`; // Close review-item
            });
            detailAnswersContainer.innerHTML = answersHtml;
            openModal();

        } catch (error) {
            console.error("Error displaying result details: ", error);
            alert("Đã xảy ra lỗi khi tải chi tiết bài làm.");
        }
    };
});