// /knowledge/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const wordsContainer = document.getElementById('words-container');
    const articlesContainer = document.getElementById('articles-container');
    
    // --- DOM Elements cho Modal (Khai báo đúng) ---
    const articleModal = document.getElementById('article-modal');
    const articleModalTitle = document.getElementById('article-modal-title');
    const articleModalBodyContent = document.getElementById('article-modal-body-content');
    const articleModalCloseBtn = document.getElementById('article-modal-close');

    // --- DOM Elements cho Text-to-Speech ---
    const enVoiceSelect = document.getElementById('en-voice-select');
    const zhVoiceSelect = document.getElementById('zh-voice-select');

    // --- Tab Switching Logic ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
        });
    });

    // --- Modal Logic (Hàm được định nghĩa đầy đủ) ---
    const openArticleModal = (title, content) => {
        articleModalTitle.textContent = title;
        articleModalBodyContent.innerHTML = content;
        articleModal.classList.add('visible');
    };

    const closeArticleModal = () => {
        articleModal.classList.remove('visible');
    };

    articleModalCloseBtn.addEventListener('click', closeArticleModal);
    articleModal.addEventListener('click', (e) => {
        // Chỉ đóng khi click vào nền mờ, không phải nội dung modal
        if (e.target === articleModal) {
            closeArticleModal();
        }
    });

    // --- TEXT-TO-SPEECH LOGIC ---
    let voices = [];
    const populateVoiceList = () => {
        voices = speechSynthesis.getVoices();
        if (voices.length === 0) return; // Thử lại nếu chưa có
        
        enVoiceSelect.innerHTML = '';
        zhVoiceSelect.innerHTML = '';

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.value = voice.name;
            
            if (voice.lang.startsWith('en')) {
                enVoiceSelect.appendChild(option);
            } else if (voice.lang.startsWith('zh')) {
                zhVoiceSelect.appendChild(option);
            }
        });
    };
    
    speechSynthesis.onvoiceschanged = populateVoiceList;
    populateVoiceList();

    const speak = (text, lang) => {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        const voiceSelect = lang.startsWith('en') ? enVoiceSelect : zhVoiceSelect;
        const selectedVoiceName = voiceSelect.value;
        const selectedVoice = voices.find(voice => voice.name === selectedVoiceName);
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            utterance.lang = lang; // Fallback
        }
        
        speechSynthesis.speak(utterance);
    };

    // --- Fetch and Display New Words ---
    db.collection('knowledge_words').orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            if (snapshot.empty) {
                wordsContainer.innerHTML = '<p>No new words have been added yet.</p>';
                return;
            }
            wordsContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = 'knowledge-card';
                card.innerHTML = `
                    <div class="word-card-header">
                        <div class="word-title">
                            <h3>${data.english_word}</h3> <button class="tts-button" data-lang="en-US">🔊</button>
                            <span class="chinese">${data.chinese_word}</span> <button class="tts-button" data-lang="zh-CN">🔊</button>
                        </div>
                    </div>
                    <h4><em>${data.vietnamese_meaning}</em></h4>
                    <p><strong>Explanation:</strong> ${data.explanation || 'Not available.'}</p>
                    <p><strong>Example:</strong> ${data.example || 'Not available.'}</p>
                    ${data.imageUrl ? `<img width="200px" src="${data.imageUrl}" alt="${data.english_word}">` : ''}
                `;
                wordsContainer.appendChild(card);
                
                card.querySelector('[data-lang="en-US"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    speak(data.english_word, 'en-US');
                });
                card.querySelector('[data-lang="zh-CN"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    speak(data.chinese_word, 'zh-CN');
                });
            });
        }).catch(err => {
            console.error("Error loading new words:", err);
            wordsContainer.innerHTML = '<p>Error loading data. Please try again later.</p>';
        });
    
    // --- Fetch and Display Articles ---
     db.collection('knowledge_articles').orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            if (snapshot.empty) {
                articlesContainer.innerHTML = '<p>No professional knowledge articles have been added yet.</p>';
                return;
            }

            articlesContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Tạo một bản tóm tắt ngắn từ nội dung HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.content;
                const summary = tempDiv.textContent.substring(0, 150) + '...';

                const card = document.createElement('div');
                card.className = 'knowledge-card';
                card.innerHTML = `
                    <h3 class="article-title-link">${data.title}</h3>
                    <p>${summary}</p>
                    <button class="read-more-btn">Read More</button>
                `;
                articlesContainer.appendChild(card);

                const titleElement = card.querySelector('.article-title-link');
                const readMoreButton = card.querySelector('.read-more-btn');
                
                // Cả tiêu đề và nút đều có thể mở modal
                const handleClick = () => {
                    openArticleModal(data.title, data.content);
                };
                titleElement.addEventListener('click', handleClick);
                readMoreButton.addEventListener('click', handleClick);
            });
        }).catch(err => {
            console.error("Error loading articles:", err);
            articlesContainer.innerHTML = '<p>Error loading data. Please try again later.</p>';
        });
});