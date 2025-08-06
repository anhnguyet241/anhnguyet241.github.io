// /user/js/user.js - PHIÊN BẢN NÂNG CẤP
document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const resultScreen = document.getElementById('result-screen');
    const userNameInput = document.getElementById('user-name');
    const quizSetListContainer = document.getElementById('quiz-set-list');
    const startBtn = document.getElementById('start-btn');
    const welcomeUser = document.getElementById('welcome-user');
    const quizSetTitle = document.getElementById('quiz-set-title');
    const timerSpan = document.getElementById('timer');
    const quizForm = document.getElementById('quiz-form');

    let userName = '';
    let currentQuizQuestions = [];
    let selectedQuizSet = null;
    let timerInterval;
    let secondsElapsed = 0;

    const showScreen = (screen) => {
        startScreen.style.display = 'none';
        quizScreen.style.display = 'none';
        resultScreen.style.display = 'none';
        if (screen) screen.style.display = 'block';
    };

    const startTimer = () => {
        secondsElapsed = 0;
        timerInterval = setInterval(() => {
            secondsElapsed++;
            const minutes = Math.floor(secondsElapsed / 60);
            const seconds = secondsElapsed % 60;
            timerSpan.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    };

    const retryQuiz = () => window.location.reload();

    const renderQuiz = () => {
        quizForm.innerHTML = '';
        currentQuizQuestions.forEach((q, index) => {
            const questionBlock = document.createElement('div');
            questionBlock.className = 'question-block';
            questionBlock.setAttribute('data-id', q.id);
            questionBlock.setAttribute('data-type', q.type);
            let questionContentHTML = `<p><strong>No ${index + 1}:</strong> ${q.text}</p>`;
            switch (q.type) {
                case 'multiple-choice':
                    const sortedOptions = Object.keys(q.options).sort();
                    const optionsHTML = sortedOptions.map(key => `<label><input type="radio" name="question-${q.id}" value="${key}" required> ${key}: ${q.options[key]}</label>`).join('');
                    questionContentHTML += `<div class="options">${optionsHTML}</div>`;
                    break;
                case 'matching':
                    const prompts = q.pairs.map(p => p.prompt);
                    const answers = [...q.pairs.map(p => p.answer)].sort(() => Math.random() - 0.5);
                    let matchingHTML = '<div class="matching-container" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center;">';
                    prompts.forEach((prompt, i) => {
                        const selectOptions = answers.map(ans => `<option value="${ans}">${ans}</option>`).join('');
                        matchingHTML += `<span class="matching-prompt">${prompt}</span><span>↔️</span><select name="question-${q.id}-${i}" class="form-control" required><option value="">-- Chọn đáp án --</option>${selectOptions}</select>`;
                    });
                    matchingHTML += '</div>';
                    questionContentHTML += matchingHTML;
                    break;
                case 'essay':
                    questionContentHTML += `<textarea name="question-${q.id}" class="form-control" rows="5" placeholder="Input your text..." required></textarea>`;
                    break;
            }
            questionBlock.innerHTML = questionContentHTML;
            quizForm.appendChild(questionBlock);
        });
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'btn btn-success';
        submitButton.textContent = 'Submit';
        quizForm.appendChild(submitButton);
    };

    const submitQuiz = async (e) => {
        e.preventDefault();
        if (!confirm('Are you sure?')) return;
        clearInterval(timerInterval);

        let autoGradedScore = 0;
        let maxAutoGradedScore = 0;
        let hasEssay = false;
        const userAnswers = [];

        currentQuizQuestions.forEach((q, index) => {
            let answerDetail = { questionId: q.id, questionType: q.type, questionText: q.text };
            if (q.type === 'essay') hasEssay = true;
            switch (q.type) {
                case 'multiple-choice':
                    maxAutoGradedScore++;
                    const selectedRadio = quizForm.querySelector(`input[name="question-${q.id}"]:checked`);
                    const userAnswerMC = selectedRadio ? selectedRadio.value : null;
                    answerDetail.userAnswer = userAnswerMC;
                    answerDetail.correctAnswer = q.correct;
                    answerDetail.options = q.options;
                    if (userAnswerMC === q.correct) autoGradedScore++;
                    break;
                case 'matching':
                    maxAutoGradedScore++;
                    const userMatching = {};
                    const correctMatching = {};
                    let isAllCorrect = true;
                    q.pairs.forEach((pair, i) => {
                        const select = quizForm.querySelector(`select[name="question-${q.id}-${i}"]`);
                        const selectedAnswer = select.value;
                        userMatching[pair.prompt] = selectedAnswer;
                        correctMatching[pair.prompt] = pair.answer;
                        if (selectedAnswer !== pair.answer) isAllCorrect = false;
                    });
                    answerDetail.userAnswer = userMatching;
                    answerDetail.correctAnswer = correctMatching;
                    if (isAllCorrect) autoGradedScore++;
                    break;
                case 'essay':
                    const essayText = quizForm.querySelector(`textarea[name="question-${q.id}"]`).value;
                    answerDetail.userAnswer = essayText;
                    answerDetail.maxPoints = q.maxPoints;
                    answerDetail.gradedPoints = null;
                    break;
            }
            userAnswers.push(answerDetail);
        });

        try {
            await db.collection('results').add({
                name: userName,
                quizSetId: selectedQuizSet.id,
                quizSetName: selectedQuizSet.name,
                autoGradedScore: autoGradedScore,
                maxAutoGradedScore: maxAutoGradedScore,
                finalScore: hasEssay ? null : autoGradedScore,
                timeTaken: secondsElapsed,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                answers: userAnswers,
                status: hasEssay ? 'pending_grading' : 'graded'
            });
            displayResults(autoGradedScore, maxAutoGradedScore, hasEssay, userAnswers);
        } catch (error) {
            console.error("Lỗi khi lưu kết quả:", error);
        }
    };

    const displayResults = (score, maxScore, hasEssay, userAnswers) => {
        let reviewHTML = '';
        if (hasEssay) {
            reviewHTML = '<p>Thank you for completing. Your test will be graded later..</p>';
        } else {
            userAnswers.forEach((answer, index) => {
                let isCorrect = false;
                let detailHTML = '';
                if (answer.questionType === 'multiple-choice') {
                    isCorrect = answer.userAnswer === answer.correctAnswer;
                    detailHTML = `<div><strong>You Choose:</strong> ${answer.options[answer.userAnswer] || 'No answes'} (${answer.userAnswer})</div>`;
                    if (!isCorrect) {
                        detailHTML += `<div class="highlight-correct"><strong>Correct Answer:</strong> ${answer.options[answer.correctAnswer]} (${answer.correctAnswer})</div>`;
                    }
                } else if (answer.questionType === 'matching') {
                    let isAllCorrect = true;
                    let matchingReview = '<ul>';
                    for (const prompt in answer.correctAnswer) {
                        const userAns = answer.userAnswer[prompt];
                        const correctAns = answer.correctAnswer[prompt];
                        const isPairCorrect = userAns === correctAns;
                        if (!isPairCorrect) isAllCorrect = false;
                        matchingReview += `<li class="${isPairCorrect ? 'text-success' : 'text-danger'}">${prompt} ↔️ ${userAns} (Đúng: ${correctAns})</li>`;
                    }
                    matchingReview += '</ul>';
                    isCorrect = isAllCorrect;
                    detailHTML = matchingReview;
                }
                reviewHTML += `<div class="review-item ${isCorrect ? 'correct' : 'incorrect'}">
                                 <p><strong>No ${index + 1}:</strong> ${answer.questionText}</p>
                                 ${detailHTML}
                               </div>`;
            });
        }
        
        let resultMessage = `Score: <strong>${score}/${maxScore}</strong>.`;
        if (hasEssay) {
            resultMessage = `Score: <strong>${score}/${maxScore}</strong>.`;
        }

        resultScreen.innerHTML = `
            <h2>Result</h2>
            <p>${resultMessage}</p>
            <p>Time: ${Math.floor(secondsElapsed / 60)} minute ${secondsElapsed % 60} second</p>
            <hr>
            <h3>check your result</h3>
            <div id="review-container" style="background: #fff; padding: 10px; border-radius: 5px;">${reviewHTML}</div>
            <button id="retry-btn-dynamic" class="btn btn-primary" style="margin-top: 20px;">Retry</button>
        `;
        resultScreen.querySelector('#retry-btn-dynamic').addEventListener('click', retryQuiz);
        showScreen(resultScreen);
    };

    const renderQuizSetList = (sets) => {
        quizSetListContainer.innerHTML = '';
        if (sets.length === 0) {
            quizSetListContainer.innerHTML = '<p>Hiện chưa có bộ đề nào để làm.</p>';
            return;
        }
        sets.forEach(set => {
            const card = document.createElement('div');
            card.className = 'quiz-set-card';
            card.dataset.setId = set.id;
            card.innerHTML = `<h4>${set.name} (${set.questionIds.length} câu)</h4><p>${set.description || 'Không có mô tả'}</p>`;
            card.addEventListener('click', () => {
                document.querySelectorAll('.quiz-set-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedQuizSet = set;
                startBtn.disabled = false;
            });
            quizSetListContainer.appendChild(card);
        });
    };
    
    const fetchQuizSets = async () => {
        try {
            const snapshot = await db.collection('quiz_sets').orderBy('createdAt', 'desc').get();
            const sets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderQuizSetList(sets);
        } catch (error) {
            console.error("Lỗi khi tải danh sách bộ đề:", error);
        }
    };

    const startQuiz = async () => {
        userName = userNameInput.value.trim();
        if (!userName) { alert('Vui lòng nhập tên của bạn.'); return; }
        if (!selectedQuizSet) { alert('Vui lòng chọn một bộ đề.'); return; }

        try {
            const questionPromises = selectedQuizSet.questionIds.map(id => db.collection('questions').doc(id).get());
            const questionDocs = await Promise.all(questionPromises);
            currentQuizQuestions = questionDocs.filter(doc => doc.exists).map(doc => ({ id: doc.id, ...doc.data() }));

            if (currentQuizQuestions.length === 0) {
                alert('Bộ đề này không có câu hỏi hợp lệ. Vui lòng chọn bộ đề khác.');
                return;
            }
            welcomeUser.textContent = `Your test ${userName}`;
            quizSetTitle.textContent = selectedQuizSet.name;
            renderQuiz();
            startTimer();
            showScreen(quizScreen);
        } catch (error) {
            console.error("Lỗi khi bắt đầu bài thi:", error);
        }
    };
    
    startBtn.addEventListener('click', startQuiz);
    quizForm.addEventListener('submit', submitQuiz);
    
    const initializeUserApp = () => {
        showScreen(startScreen);
        fetchQuizSets();
    };

    initializeUserApp();
});