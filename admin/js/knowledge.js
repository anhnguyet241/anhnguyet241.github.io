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

    const wordEnglishInput = document.getElementById('word-english');
    const wordChineseInput = document.getElementById('word-chinese');
    const wordVietnameseInput = document.getElementById('word-vietnamese');
    const wordExplanationInput = document.getElementById('word-explanation');
    const wordExampleInput = document.getElementById('word-example');
    const wordImageUrlInput = document.getElementById('word-imageUrl');
    const wordFormTitle = document.getElementById('word-form-title');

    const resetWordForm = () => {
        wordForm.reset();
        wordIdInput.value = '';
        wordFormTitle.textContent = 'Thêm Từ mới';
        wordCancelBtn.style.display = 'none';
    };

    wordCancelBtn.addEventListener('click', resetWordForm);

    wordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const wordData = {
            english_word: wordEnglishInput.value.trim(),
            chinese_word: wordChineseInput.value.trim(),
            vietnamese_meaning: wordVietnameseInput.value.trim(),
            explanation: wordExplanationInput.value.trim(),
            example: wordExampleInput.value.trim(),
            imageUrl: wordImageUrlInput.value.trim()
        };

        if (!wordData.english_word || !wordData.chinese_word || !wordData.vietnamese_meaning) {
            alert('Vui lòng nhập đủ thông tin Tiếng Anh, Tiếng Trung và nghĩa Tiếng Việt.');
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
                <td>${data.english_word}</td>
                <td>${data.chinese_word}</td>
                <td>${data.vietnamese_meaning}</td>
                <td>
                    <button class="btn btn-warning btn-sm edit-word">Sửa</button>
                    <button class="btn btn-danger btn-sm delete-word">Xóa</button>
                </td>
            `;
            wordsList.appendChild(tr);

            tr.querySelector('.edit-word').addEventListener('click', () => {
                wordIdInput.value = doc.id;
                wordEnglishInput.value = data.english_word || '';
                wordChineseInput.value = data.chinese_word || '';
                wordVietnameseInput.value = data.vietnamese_meaning || '';
                wordExplanationInput.value = data.explanation || '';
                wordExampleInput.value = data.example || '';
                wordImageUrlInput.value = data.imageUrl || '';
                wordFormTitle.textContent = 'Sửa Từ mới';
                wordCancelBtn.style.display = 'inline-block';
                window.scrollTo(0, 0);
            });
            tr.querySelector('.delete-word').addEventListener('click', async () => {
                if (confirm(`Xóa từ "${data.english_word}"?`)) {
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
    const articleTitleInput = document.getElementById('article-title');
    const articleFormTitle = document.getElementById('article-form-title');

    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image', 'video'],
                ['clean']
            ]
        },
        placeholder: 'Soạn thảo nội dung bài viết ở đây...'
    });

    const resetArticleForm = () => {
        articleForm.reset();
        articleIdInput.value = '';
        quill.root.innerHTML = '';
        articleFormTitle.textContent = 'Thêm Bài viết';
        articleCancelBtn.style.display = 'none';
    };
    
    articleCancelBtn.addEventListener('click', resetArticleForm);

    articleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = articleTitleInput.value.trim();
        const contentHTML = quill.root.innerHTML;

        if (!title || contentHTML === '<p><br></p>') {
            alert('Vui lòng nhập Tiêu đề và Nội dung.');
            return;
        }

        const articleData = {
            title: title,
            content: contentHTML,
        };

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
                articleTitleInput.value = data.title;
                quill.root.innerHTML = data.content;
                articleFormTitle.textContent = 'Sửa Bài viết';
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