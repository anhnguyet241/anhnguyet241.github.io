// /knowledge/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
        });
    });

    // --- Fetch and Display New Words ---
    const wordsContainer = document.getElementById('words-container');
    db.collection('knowledge_words').orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            if (snapshot.empty) {
                wordsContainer.innerHTML = '<p>No new words have been added yet..</p>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                html += `
                    <div class="knowledge-card">
                        <h3>${data.word} - <em>${data.meaning}</em></h3>
                        <p><strong>Giải thích:</strong> ${data.explanation}</p>
                        <p><strong>Ví dụ:</strong> ${data.example}</p>
                        ${data.imageUrl ? `<img width="200px" src="${data.imageUrl}" alt="${data.word}" style="max-width: 100%; height: auto; border-radius: 5px;">` : ''}
                    </div>
                `;
            });
            wordsContainer.innerHTML = html;
        }).catch(err => {
            console.error(err);
            wordsContainer.innerHTML = '<p>Lỗi khi tải dữ liệu.</p>';
        });
    
    // --- Fetch and Display Articles with EXPAND/COLLAPSE logic ---
    const articlesContainer = document.getElementById('articles-container');
     db.collection('knowledge_articles').orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            if (snapshot.empty) {
                articlesContainer.innerHTML = '<p>No posts yet.</p>';
                return;
            }

            articlesContainer.innerHTML = ''; // Xóa chữ "Đang tải..."

            snapshot.forEach(doc => {
                const data = doc.data();
                const contentWithBreaks = data.content.replace(/\n/g, '<br>');

                // Tạo từng card một để gắn event listener riêng
                const card = document.createElement('div');
                card.className = 'knowledge-card';
                card.innerHTML = `
                    <h3>${data.title}</h3>
                    <div class="article-content">
                        <p>${contentWithBreaks}</p>
                    </div>
                    <span class="toggle-expand">Expand</span>
                `;
                articlesContainer.appendChild(card);

                // Gắn sự kiện click cho nút "Xem thêm" của card vừa tạo
                const contentDiv = card.querySelector('.article-content');
                const toggleButton = card.querySelector('.toggle-expand');

                toggleButton.addEventListener('click', () => {
                    // Chuyển đổi class 'expanded'
                    contentDiv.classList.toggle('expanded');
                    
                    // Đổi chữ trên nút
                    if (contentDiv.classList.contains('expanded')) {
                        toggleButton.textContent = 'Colapse';
                    } else {
                        toggleButton.textContent = 'Expand';
                    }
                });
            });
        }).catch(err => {
            console.error(err);
            articlesContainer.innerHTML = '<p>Lỗi khi tải dữ liệu.</p>';
        });
});