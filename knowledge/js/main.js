// /knowledge/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Các DOM Elements cũ giữ nguyên ---
    const articleModal = document.getElementById('article-modal');
    // ...

    // --- DOM Elements MỚI ---
    const enVoiceSelect = document.getElementById('en-voice-select');
    const zhVoiceSelect = document.getElementById('zh-voice-select');

    // --- Tab Switching & Modal Logic (Giữ nguyên) ---
    // ...

    // --- TEXT-TO-SPEECH LOGIC (NÂNG CẤP) ---
    let voices = []; // Biến toàn cục để lưu danh sách giọng đọc

    const populateVoiceList = () => {
        voices = speechSynthesis.getVoices();
        enVoiceSelect.innerHTML = '';
        zhVoiceSelect.innerHTML = '';

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            
            if (voice.lang.startsWith('en')) {
                enVoiceSelect.appendChild(option);
            } else if (voice.lang.startsWith('zh')) {
                zhVoiceSelect.appendChild(option);
            }
        });
    };
    
    // Sự kiện này rất quan trọng, nó đảm bảo getVoices() không bị rỗng
    speechSynthesis.onvoiceschanged = populateVoiceList;
    populateVoiceList(); // Gọi một lần phòng trường hợp đã load sẵn

    const speak = (text, lang) => {
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Xác định dropdown và ngôn ngữ cần dùng
        const voiceSelect = lang.startsWith('en') ? enVoiceSelect : zhVoiceSelect;
        const selectedVoiceName = voiceSelect.value;

        // Tìm đối tượng voice dựa trên tên đã chọn
        const selectedVoice = voices.find(voice => voice.name === selectedVoiceName.split(' (')[0]);
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            // Fallback nếu không tìm thấy, trình duyệt sẽ tự chọn
            utterance.lang = lang;
        }
        
        speechSynthesis.speak(utterance);
    };

    // --- Fetch and Display New Words (CẬP NHẬT) ---
    const wordsContainer = document.getElementById('words-container');
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
                            <h3>${data.english_word}</h3> <button class="tts-button" data-lang="en-US">🔊</button> |
                            <span class="chinese">${data.chinese_word}</span> <button class="tts-button" data-lang="zh-CN">🔊</button>
                        </div>
                        <div class="word-tts-buttons">
                           
                        </div>
                    </div>
                    <h4><em>${data.vietnamese_meaning}</em></h4>
                    <p><strong>Explanation:</strong> ${data.explanation || 'Not available.'}</p>
                    <p><strong>Example:</strong> ${data.example || 'Not available.'}</p>
                    ${data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.english_word}">` : ''}
                `;
                wordsContainer.appendChild(card);
                
                // Gắn sự kiện cho các nút loa, hàm speak bây giờ sẽ tự tìm giọng được chọn
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
    const articlesContainer = document.getElementById('articles-container');
     db.collection('knowledge_articles').orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            if (snapshot.empty) {
                articlesContainer.innerHTML = '<p>No professional knowledge articles have been added yet.</p>';
                return;
            }

            articlesContainer.innerHTML = '';

            snapshot.forEach(doc => {
                const data = doc.data();
                
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