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
    const wordCategoryInput = document.getElementById('word-category');
    const wordFormTitle = document.getElementById('word-form-title');

    // --- Quill Image Handler (compress before embed) ---
    const quillImageHandler = function() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = () => {
            const file = input.files[0];
            if (/^image\//.test(file.type)) {
                compressAndInsertImage(file, this.quill);
            }
        };
    };

    const compressAndInsertImage = (file, quillInstance) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const max_size = 600;

                if (width > height) {
                    if (width > max_size) { height *= max_size / width; width = max_size; }
                } else {
                    if (height > max_size) { width *= max_size / height; height = max_size; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                const range = quillInstance.getSelection(true);
                quillInstance.insertEmbed(range.index, 'image', compressedBase64);
                quillInstance.setSelection(range.index + 1);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // --- Quill Config for Example editors (compact toolbar with image support) ---
    const exampleQuillConfig = {
        theme: 'snow',
        modules: {
            toolbar: {
                container: [
                    ['bold', 'italic'],
                    ['image']
                ],
                handlers: { image: quillImageHandler }
            }
        }
    };

    const quillExampleVi = new Quill('#example-editor-vi', { ...exampleQuillConfig, placeholder: 'Ví dụ tiếng Việt... (có thể dán ảnh)' });
    const quillExampleZh = new Quill('#example-editor-zh', { ...exampleQuillConfig, placeholder: '中文例句... (可以粘贴图片)' });
    const quillExampleEn = new Quill('#example-editor-en', { ...exampleQuillConfig, placeholder: 'English example... (paste images OK)' });

    // --- Textarea references for explanation ---
    const explViInput = document.getElementById('word-explanation-vi');
    const explZhInput = document.getElementById('word-explanation-zh');
    const explEnInput = document.getElementById('word-explanation-en');

    // --- Image Upload & Paste Elements (Main Flashcard Thumbnails) ---
    const wordImageUploadArea = document.getElementById('word-image-upload-area');
    const wordImageFile = document.getElementById('word-image-file');
    const wordImagePreviewContainer = document.getElementById('word-image-preview-container');
    
    let currentWordImagesBase64 = [];

    const renderImagePreviews = () => {
        wordImagePreviewContainer.innerHTML = '';
        if (currentWordImagesBase64.length === 0) {
            wordImagePreviewContainer.style.display = 'none';
            wordImageUploadArea.style.display = 'block';
            return;
        }

        wordImagePreviewContainer.style.display = 'flex';
        if (currentWordImagesBase64.length >= 3) {
            wordImageUploadArea.style.display = 'none';
        } else {
            wordImageUploadArea.style.display = 'block';
        }

        currentWordImagesBase64.forEach((base64Str, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'img-preview-item';

            const img = document.createElement('img');
            img.src = base64Str;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-img';
            removeBtn.innerHTML = '&times;';
            
            removeBtn.onclick = () => {
                currentWordImagesBase64.splice(index, 1);
                renderImagePreviews();
                wordImageFile.value = '';
            };

            wrapper.appendChild(img);
            wrapper.appendChild(removeBtn);
            wordImagePreviewContainer.appendChild(wrapper);
        });
    };

    // --- Image Processing Logic ---
    const processImageFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 800;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                if (currentWordImagesBase64.length < 3) {
                    currentWordImagesBase64.push(compressedBase64);
                    renderImagePreviews();
                } else {
                    alert('Chỉ được phép tải lên tối đa 3 ảnh minh họa!');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Events for Upload Area
    wordImageUploadArea.addEventListener('click', () => {
        wordImageFile.click();
    });

    wordImageFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0]);
        }
    });

    // Event for Paste (dán ảnh) - only for main thumbnail area
    document.addEventListener('paste', (e) => {
        const activeTag = document.activeElement.tagName.toLowerCase();
        // Skip if user is typing in input/textarea/select
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
            if (document.activeElement.id !== 'word-image-upload-area') {
                return; 
            }
        }
        // Skip if inside a Quill editor (Quill handles its own paste)
        if (document.activeElement.closest('.ql-editor')) return;
        
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                processImageFile(file);
                e.preventDefault();
                break;
            }
        }
    });
    
    wordImageUploadArea.setAttribute('tabindex', '0'); 

    // --- Helper: get quill content or empty string ---
    const getQuillContent = (quill) => {
        const html = quill.root.innerHTML;
        return (html === '<p><br></p>' || html === '') ? '' : html;
    };

    const resetWordForm = () => {
        wordForm.reset();
        wordIdInput.value = '';
        wordFormTitle.textContent = '✏️ Thêm Từ mới';
        wordCancelBtn.style.display = 'none';
        
        explViInput.value = '';
        explZhInput.value = '';
        explEnInput.value = '';
        quillExampleVi.root.innerHTML = '';
        quillExampleZh.root.innerHTML = '';
        quillExampleEn.root.innerHTML = '';

        // Reset Image Preview
        currentWordImagesBase64 = [];
        renderImagePreviews();
    };

    wordCancelBtn.addEventListener('click', resetWordForm);

    wordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const wordData = {
            category: wordCategoryInput.value || 'Từ mới',
            english_word: wordEnglishInput.value.trim(),
            chinese_word: wordChineseInput.value.trim(),
            vietnamese_meaning: wordVietnameseInput.value.trim(),
            explanation_vi: explViInput.value.trim(),
            explanation_zh: explZhInput.value.trim(),
            explanation_en: explEnInput.value.trim(),
            example_vi: getQuillContent(quillExampleVi),
            example_zh: getQuillContent(quillExampleZh),
            example_en: getQuillContent(quillExampleEn),
            // Legacy compat
            explanation: explViInput.value.trim(),
            example: getQuillContent(quillExampleVi),
            imageUrl: currentWordImagesBase64.length > 0 ? currentWordImagesBase64[0] : '',
            imageUrls: currentWordImagesBase64
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
            const catVal = data.category || 'Từ mới';
            const firstImg = (data.imageUrls && data.imageUrls.length > 0) ? data.imageUrls[0] : data.imageUrl;
            
            tr.innerHTML = `
                <td>
                    ${firstImg ? `<img src="${firstImg}" alt="${data.chinese_word}" style="max-height: 40px; border-radius: 4px; object-fit: cover;">` : '<span style="color:#aaa; font-size:12px;">Không có</span>'}
                </td>
                <td>
                    <select class="form-control category-quick-edit" style="padding: 4px; border-radius: 4px; border: 1px solid #ccc; font-size: 0.9em; min-width: 100px;">
                        <option value="Loại thẻ" ${catVal === 'Loại thẻ' ? 'selected' : ''}>Loại thẻ</option>
                        <option value="Từ mới" ${catVal === 'Từ mới' ? 'selected' : ''}>Từ mới</option>
                        <option value="Quốc gia" ${catVal === 'Quốc gia' ? 'selected' : ''}>Quốc gia</option>
                        <option value="Ngân hàng" ${catVal === 'Ngân hàng' ? 'selected' : ''}>Ngân hàng</option>
                        <option value="app pending" ${catVal === 'app pending' ? 'selected' : ''}>app pending</option>
                        <option value="Khác" ${catVal === 'Khác' ? 'selected' : ''}>Khác</option>
                    </select>
                </td>
                <td>${data.vietnamese_meaning}</td>
                <td style="color: #dc3545; font-weight: 600;">${data.chinese_word}</td>
                <td style="color: #2563eb;">${data.english_word}</td>
                <td>
                    <button class="btn btn-warning btn-sm edit-word">Sửa</button>
                    <button class="btn btn-danger btn-sm delete-word">Xóa</button>
                </td>
            `;
            wordsList.appendChild(tr);

            tr.querySelector('.category-quick-edit').addEventListener('change', async (e) => {
                const newCat = e.target.value;
                try {
                    await db.collection('knowledge_words').doc(doc.id).update({ category: newCat });
                    e.target.style.borderColor = '#28a745';
                    e.target.style.backgroundColor = '#d4edda';
                    setTimeout(() => {
                        e.target.style.borderColor = '#ccc';
                        e.target.style.backgroundColor = 'white';
                    }, 1000);
                } catch (err) {
                    console.error("Error Quick-updating category: ", err);
                    alert('Lỗi cập nhật danh mục!');
                }
            });

            tr.querySelector('.edit-word').addEventListener('click', () => {
                wordIdInput.value = doc.id;
                
                let catVal = data.category || 'Từ mới';
                const validOptions = ['Loại thẻ', 'Từ mới', 'Quốc gia', 'Ngân hàng', 'app pending', 'Khác'];
                if(!validOptions.includes(catVal)) catVal = 'Khác';
                wordCategoryInput.value = catVal;
                
                wordEnglishInput.value = data.english_word || '';
                wordChineseInput.value = data.chinese_word || '';
                wordVietnameseInput.value = data.vietnamese_meaning || '';
                explViInput.value = data.explanation_vi || data.explanation || '';
                explZhInput.value = data.explanation_zh || '';
                explEnInput.value = data.explanation_en || '';
                quillExampleVi.root.innerHTML = data.example_vi || data.example || '';
                quillExampleZh.root.innerHTML = data.example_zh || '';
                quillExampleEn.root.innerHTML = data.example_en || '';
                
                // Hydrate Image Preview
                currentWordImagesBase64 = [];
                if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
                    currentWordImagesBase64 = [...data.imageUrls];
                } else if (data.imageUrl) {
                    currentWordImagesBase64 = [data.imageUrl];
                }
                renderImagePreviews();

                wordFormTitle.textContent = '📝 Sửa Từ mới';
                wordCancelBtn.style.display = 'inline-block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
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