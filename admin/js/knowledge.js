// /admin/js/knowledge.js
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

    // --- LOGIC FOR NEW WORDS ---
    const wordForm = document.getElementById('word-form');
    const wordIdInput = document.getElementById('word-id');
    const wordsList = document.getElementById('words-list');
    const wordCancelBtn = document.getElementById('word-cancel-btn');

    const resetWordForm = () => {
        wordForm.reset();
        wordIdInput.value = '';
        document.getElementById('word-form-title').textContent = 'Thêm Từ mới';
        wordCancelBtn.style.display = 'none';
    };

    wordCancelBtn.addEventListener('click', resetWordForm);

    wordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const wordData = {
            word: document.getElementById('word-term').value.trim(),
            meaning: document.getElementById('word-meaning').value.trim(),
            explanation: document.getElementById('word-explanation').value.trim(),
            example: document.getElementById('word-example').value.trim(),
            imageUrl: document.getElementById('word-imageUrl').value.trim()
        };

        if (!wordData.word || !wordData.meaning) {
            alert('Vui lòng nhập Từ mới và Nghĩa của từ.');
            return;
        }

        const id = wordIdInput.value;
        try {
            if (id) {
                await db.collection('knowledge_words').doc(id).update(wordData);
            } else {
                wordData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('knowledge_words').add(wordData);
            }
            resetWordForm();
        } catch (error) {
            console.error("Error saving word: ", error);
        }
    });

    db.collection('knowledge_words').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        wordsList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.word}</td>
                <td>${data.meaning}</td>
                <td>
                    <button class="btn btn-warning btn-sm edit-word">Sửa</button>
                    <button class="btn btn-danger btn-sm delete-word">Xóa</button>
                </td>
            `;
            wordsList.appendChild(tr);

            tr.querySelector('.edit-word').addEventListener('click', () => {
                wordIdInput.value = doc.id;
                document.getElementById('word-term').value = data.word;
                document.getElementById('word-meaning').value = data.meaning;
                document.getElementById('word-explanation').value = data.explanation;
                document.getElementById('word-example').value = data.example;
                document.getElementById('word-imageUrl').value = data.imageUrl || '';
                document.getElementById('word-form-title').textContent = 'Sửa Từ mới';
                wordCancelBtn.style.display = 'inline-block';
                window.scrollTo(0, 0);
            });
            tr.querySelector('.delete-word').addEventListener('click', async () => {
                if (confirm(`Xóa từ "${data.word}"?`)) {
                    await db.collection('knowledge_words').doc(doc.id).delete();
                }
            });
        });
    });

    // --- LOGIC FOR ARTICLES ---
    const articleForm = document.getElementById('article-form');
    const articleIdInput = document.getElementById('article-id');
    const articlesList = document.getElementById('articles-list');
    const articleCancelBtn = document.getElementById('article-cancel-btn');

    const resetArticleForm = () => {
        articleForm.reset();
        articleIdInput.value = '';
        document.getElementById('article-form-title').textContent = 'Thêm Bài viết';
        articleCancelBtn.style.display = 'none';
    };
    
    articleCancelBtn.addEventListener('click', resetArticleForm);

    articleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const articleData = {
            title: document.getElementById('article-title').value.trim(),
            content: document.getElementById('article-content').value.trim(),
        };

        if (!articleData.title || !articleData.content) {
            alert('Vui lòng nhập Tiêu đề và Nội dung.');
            return;
        }

        const id = articleIdInput.value;
        try {
            if (id) {
                await db.collection('knowledge_articles').doc(id).update(articleData);
            } else {
                articleData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('knowledge_articles').add(articleData);
            }
            resetArticleForm();
        } catch (error) {
            console.error("Error saving article: ", error);
        }
    });

    db.collection('knowledge_articles').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        articlesList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.title}</td>
                <td>
                    <button class="btn btn-warning btn-sm edit-article">Sửa</button>
                    <button class="btn btn-danger btn-sm delete-article">Xóa</button>
                </td>
            `;
            articlesList.appendChild(tr);

            tr.querySelector('.edit-article').addEventListener('click', () => {
                articleIdInput.value = doc.id;
                document.getElementById('article-title').value = data.title;
                document.getElementById('article-content').value = data.content;
                document.getElementById('article-form-title').textContent = 'Sửa Bài viết';
                articleCancelBtn.style.display = 'inline-block';
                 window.scrollTo(0, 0);
            });
            tr.querySelector('.delete-article').addEventListener('click', async () => {
                if (confirm(`Xóa bài viết "${data.title}"?`)) {
                    await db.collection('knowledge_articles').doc(doc.id).delete();
                }
            });
        });
    });
});