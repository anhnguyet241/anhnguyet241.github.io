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

    // Check URL for direct tab access (e.g., ?tab=discuss)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        const targetTab = Array.from(tabButtons).find(btn => btn.dataset.tab === tabParam);
        if (targetTab) {
            targetTab.click();
        }
    }

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

    // ==========================================
    // --- DISCUSS LOGIC ---
    // ==========================================
    
    // Khởi tạo các Quill editors cho Discuss
    const discussEditor = new Quill('#discuss-quill-editor', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['image', 'link']] }
    });
    // commentEditor đã bị gỡ bỏ, dùng input cơ bản

    // DOM Elements cho Discuss
    const discussionsContainer = document.getElementById('discussions-container');
    const btnCreateDiscussion = document.getElementById('btn-create-discussion');
    const createDiscussModal = document.getElementById('create-discuss-modal');
    const createDiscussForm = document.getElementById('create-discuss-form');
    
    const viewDiscussModal = document.getElementById('view-discuss-modal');
    const viewDiscussTitle = document.getElementById('view-discuss-title');
    const viewDiscussAuthor = document.getElementById('view-discuss-author');
    const viewDiscussTime = document.getElementById('view-discuss-time');
    const viewDiscussContent = document.getElementById('view-discuss-content');
    const viewDiscussReplyCount = document.getElementById('view-discuss-reply-count');
    const commentsContainer = document.getElementById('comments-container');
    const btnSubmitComment = document.getElementById('btn-submit-comment');
    
    let currentDiscussionId = null;
    let replyingToRootId = null;
    let replyingToAuthor = null;
    let commentImageBase64 = null;

    // Load tên lưu trong localStorage (nếu có)
    const savedName = localStorage.getItem('userName');
    if (savedName) {
        document.getElementById('discuss-author').value = savedName;
        document.getElementById('comment-author').value = savedName;
    }

    // Load Danh sách Thảo luận
    const loadDiscussions = () => {
        db.collection('discussions').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                discussionsContainer.innerHTML = '<p>Chưa có câu hỏi nào. Hãy là người đầu tiên đặt câu hỏi!</p>';
                return;
            }
            discussionsContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = 'knowledge-card';
                card.style.cursor = 'pointer';
                const date = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'Mới đây';
                
                // Tạo tóm tắt và trích xuất ảnh đầu tiên từ HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.content || '';
                
                // Trích xuất chữ
                let summaryText = tempDiv.textContent.trim();
                if(summaryText.length > 120) {
                    summaryText = summaryText.substring(0, 120) + '...';
                }

                // Trích xuất ảnh
                const firstImg = tempDiv.querySelector('img');
                const imgPreviewHtml = firstImg ? `<div style="margin-top: 10px; margin-bottom: 10px;"><img src="${firstImg.src}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px;"></div>` : '';

                card.innerHTML = `
                    <h3 style="margin-top: 0; color: #007bff; margin-bottom: 5px;">${data.title}</h3>
                    <div style="font-size: 0.8em; color: #6c757d; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                        <strong>${data.author}</strong> - ${date}
                    </div>
                    ${imgPreviewHtml}
                    <div style="font-size: 0.95em; color: #444; margin-bottom: 15px; line-height: 1.5; word-wrap: break-word;">
                        ${summaryText} <span style="font-size: 0.85em; color: #007bff; white-space: nowrap;">Xem tiếp &raquo;</span>
                    </div>
                    <div style="font-size: 0.85em; display: flex; justify-content: space-between; align-items: center; color: #6c757d;">
                        <span>💬 <strong>${data.replyCount || 0}</strong> bình luận</span>
                    </div>
                `;
                card.addEventListener('click', () => openViewDiscussModal(doc.id, data));
                discussionsContainer.appendChild(card);
            });
        }, err => {
            console.error("Error loading discussions:", err);
            discussionsContainer.innerHTML = '<p>Lỗi tải dữ liệu thảo luận.</p>';
        });
    };

    // Gọi load data ngay từ đầu
    loadDiscussions();

    // Xử lý Modal Mở/Đóng Tạo Thảo luận
    btnCreateDiscussion.addEventListener('click', () => {
        createDiscussModal.classList.add('visible');
    });
    document.getElementById('create-discuss-close').addEventListener('click', () => {
        createDiscussModal.classList.remove('visible');
    });

    // Handle Mở Modal Chi Tiết Thảo luận
    const openViewDiscussModal = (id, data) => {
        currentDiscussionId = id;
        viewDiscussTitle.textContent = data.title;
        viewDiscussAuthor.textContent = data.author;
        viewDiscussTime.textContent = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'Mới đây';
        viewDiscussContent.innerHTML = data.content;
        viewDiscussReplyCount.textContent = data.replyCount || 0;
        
        viewDiscussModal.classList.add('visible');
        loadComments(id);
    };

    const cancelReply = () => {
        replyingToRootId = null;
        replyingToAuthor = null;
        const ind = document.getElementById('reply-indicator-container');
        if (ind) ind.style.display = 'none';
    };

    const clearCommentForm = () => {
        document.getElementById('comment-text').value = '';
        document.getElementById('comment-text').style.height = '';
        document.getElementById('comment-image-input').value = '';
        commentImageBase64 = null;
        document.getElementById('comment-image-preview-container').style.display = 'none';
        cancelReply();
    };

    document.getElementById('btn-cancel-reply').addEventListener('click', cancelReply);

    document.getElementById('btn-remove-image').addEventListener('click', () => {
        document.getElementById('comment-image-input').value = '';
        commentImageBase64 = null;
        document.getElementById('comment-image-preview-container').style.display = 'none';
    });

    // Handle File Input
    document.getElementById('btn-attach-image').addEventListener('click', () => {
        document.getElementById('comment-image-input').click();
    });

    document.getElementById('comment-image-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Nén ảnh, chất lượng 0.7 để đảm bảo dưới 1MB
                    commentImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    
                    document.getElementById('comment-image-preview').src = commentImageBase64;
                    document.getElementById('comment-image-preview-container').style.display = 'block';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Đóng Modal View Discuss
    document.getElementById('view-discuss-close').addEventListener('click', () => {
        viewDiscussModal.classList.remove('visible');
        currentDiscussionId = null;
        clearCommentForm();
    });

    // Handle Submit Tạo Thảo Luận Mới
    createDiscussForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const author = document.getElementById('discuss-author').value.trim();
        const title = document.getElementById('discuss-title').value.trim();
        const content = discussEditor.root.innerHTML;

        if (!author || !title || discussEditor.getText().trim() === '') {
            alert('Vui lòng điền đầy đủ tên, tiêu đề và nội dung!');
            return;
        }

        localStorage.setItem('userName', author); // Lưu tên để dùng sau

        try {
            await db.collection('discussions').add({
                author: author,
                title: title,
                content: content,
                replyCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            createDiscussModal.classList.remove('visible');
            createDiscussForm.reset();
            discussEditor.root.innerHTML = '';
        } catch (error) {
            console.error('Lỗi khi đăng câu hỏi:', error);
            alert('Lỗi đăng bài! Vui lòng thử lại.');
        }
    });

    const createCommentElement = (data, isReply, rootId) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 10px 0; margin-bottom: 5px; display: flex; flex-direction: row; align-items: flex-start; gap: 10px;';
        if (!isReply) {
            div.style.borderBottom = '1px solid #f8f9fa';
        }
        
        const date = data.createdAt ? (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toLocaleString('vi-VN') : new Date(data.createdAt).toLocaleString('vi-VN')) : 'Mới đây';
        
        let contentHtml = `<div style="font-size: 0.95em; color: #333; margin-top: 5px; white-space: pre-wrap;">${data.content}</div>`;
        if (data.imageUrl) {
            contentHtml += `<div style="margin-top: 5px;"><img src="${data.imageUrl}" class="comment-image-clickable" style="max-height: 150px; border-radius: 8px; cursor: pointer; transition: transform 0.2s;"></div>`;
        }
        // Backward compatibility for old Quill comments
        if (data.content && data.content.includes('<') && data.content.includes('>')) {
             contentHtml = `<div class="ql-editor" style="padding: 0; min-height: auto; margin-top: 5px;">${data.content}</div>`;
        }
        
        const replyText = data.replyToAuthor ? ` <span style="font-size: 0.9em; color: #6c757d; font-weight: normal;">▶ trả lời <strong>${data.replyToAuthor}</strong></span>` : '';
        const passedRootId = rootId || data.id;

        const avatarInitial = data.author ? data.author.charAt(0).toUpperCase() : 'U';

        div.innerHTML = `
            <div style="width: 35px; height: 35px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #555; flex-shrink: 0;">${avatarInitial}</div>
            <div style="flex-grow: 1;">
                <div style="font-size: 0.85em; color: #6c757d; font-weight: 500;">
                    ${data.author}${replyText}
                </div>
                ${contentHtml}
                <div style="font-size: 0.8em; color: #adb5bd; margin-top: 5px; display: flex; align-items: center; gap: 15px;">
                    <span>${date}</span>
                    <button class="btn-reply-comment" data-author="${data.author}" data-rootid="${passedRootId}" style="background: none; border: none; color: #6c757d; cursor: pointer; font-weight: bold; padding: 0;">Trả lời</button>
                </div>
            </div>
        `;
        return div;
    };

    const renderCommentsTreeArray = (commentsArr) => {
        commentsContainer.innerHTML = '';
        let roots = [];
        let replies = {}; 
        
        commentsArr.forEach(c => {
             if (c.parentRootId) {
                  if (!replies[c.parentRootId]) replies[c.parentRootId] = [];
                  replies[c.parentRootId].push(c);
             } else {
                  roots.push(c);
             }
        });

        roots.forEach(root => {
             const rootEl = createCommentElement(root, false, root.id);
             commentsContainer.appendChild(rootEl);
             
             if (replies[root.id]) {
                  const repliesContainer = document.createElement('div');
                  repliesContainer.style.marginLeft = '45px';
                  repliesContainer.style.borderLeft = '2px solid #eee';
                  repliesContainer.style.paddingLeft = '10px';
                  
                  // Sort replies locally by time
                  replies[root.id].sort((a,b) => {
                       const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                       const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                       return tA - tB;
                  }).forEach(child => {
                       const childEl = createCommentElement(child, true, root.id);
                       repliesContainer.appendChild(childEl);
                  });
                  commentsContainer.appendChild(repliesContainer);
             }
        });
        commentsContainer.scrollTop = commentsContainer.scrollHeight;
    };

    // Load Comments cho một Discussion
    const loadComments = (discussionId) => {
        commentsContainer.innerHTML = '<div class="loader"></div>';
        db.collection('comments')
            .where('discussionId', '==', discussionId)
            .orderBy('createdAt', 'asc') // Cũ nhất xếp trên
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    commentsContainer.innerHTML = '<p style="color: #6c757d; font-style: italic;">Chưa có bình luận nào.</p>';
                    return;
                }
                let arr = [];
                snapshot.forEach(doc => arr.push({id: doc.id, ...doc.data()}));
                renderCommentsTreeArray(arr);
            }, err => {
                console.error("Lỗi tải bình luận:", err);
                // commentsContainer.innerHTML = '<p>Lỗi tải bình luận. Vui lòng thử tải lại trang hoặc kiểm tra Firestore Index.</p>';
                // If the index is missing, it will throw an error. In that case we render without ordering for now, so it at least works while the user builds the index
                if(err.code === 'failed-precondition'){
                    console.log("Missing index, falling back to unordered fetch for now.");
                    db.collection('comments')
                        .where('discussionId', '==', discussionId)
                        .onSnapshot(fallbackSnapshot => {
                             if (fallbackSnapshot.empty) {
                                commentsContainer.innerHTML = '<p style="color: #6c757d; font-style: italic;">Chưa có bình luận nào.</p>';
                                return;
                             }
                             let commentsArr = [];
                             fallbackSnapshot.forEach(doc => commentsArr.push({id: doc.id, ...doc.data()}));
                             // Sort locally
                             commentsArr.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
                             renderCommentsTreeArray(commentsArr);
                        });
                } else {
                     commentsContainer.innerHTML = '<p>Lỗi tải bình luận.</p>';
                }
            });
            
        // Event delegation cho nút trả lời bình luận và xem ảnh full màn hình
        if (!commentsContainer.dataset.hasListener) {
            commentsContainer.addEventListener('click', (e) => {
                const replyBtn = e.target.closest('.btn-reply-comment');
                if (replyBtn) {
                    replyingToAuthor = replyBtn.getAttribute('data-author');
                    replyingToRootId = replyBtn.getAttribute('data-rootid');
                    
                    document.getElementById('reply-indicator-name').textContent = replyingToAuthor;
                    document.getElementById('reply-indicator-container').style.display = 'flex';
                    
                    const textInput = document.getElementById('comment-text');
                    textInput.focus();
                    textInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }

                if (e.target.classList.contains('comment-image-clickable')) {
                    const viewerModal = document.getElementById('image-viewer-modal');
                    const viewerImg = document.getElementById('image-viewer-img');
                    viewerImg.src = e.target.src;
                    viewerModal.style.display = 'flex';
                }
            });
            commentsContainer.dataset.hasListener = "true";
        }
    };

    // Handle Thêm Comment
    btnSubmitComment.addEventListener('click', async () => {
        if (!currentDiscussionId) return;
        
        const author = document.getElementById('comment-author').value.trim();
        const content = document.getElementById('comment-text').value.trim();

        if (!author || (!content && !commentImageBase64)) {
            alert('Vui lòng nhập tên và nội dung bình luận hoặc ảnh!');
            return;
        }
        
        localStorage.setItem('userName', author);

        // Nút pending state
        btnSubmitComment.disabled = true;
        btnSubmitComment.style.opacity = '0.5';

        try {
            // 1. Thêm comment mới
            const batch = db.batch();
            const newCommentRef = db.collection('comments').doc();
            batch.set(newCommentRef, {
                discussionId: currentDiscussionId,
                author: author,
                content: content,
                imageUrl: commentImageBase64,
                parentRootId: replyingToRootId,
                replyToAuthor: replyingToAuthor,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // 2. Tăng replyCount trong bài viết gốc
            const discussionRef = db.collection('discussions').doc(currentDiscussionId);
            batch.update(discussionRef, {
                replyCount: firebase.firestore.FieldValue.increment(1)
            });

            await batch.commit();

            // Clear input
            clearCommentForm();
        } catch (error) {
            console.error('Lỗi khi gửi bình luận:', error);
            alert('Lỗi gửi bình luận!');
        } finally {
            btnSubmitComment.disabled = false;
            btnSubmitComment.style.opacity = '1';
        }
    });

    // Thêm chức năng đóng modal khi click ra bg (những modal mới)
    const modals = document.querySelectorAll('.article-modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // Prevent closing create-discuss-modal when clicking outside to avoid losing typed content
                if (modal.id === 'create-discuss-modal') {
                    return; 
                }
                modal.classList.remove('visible');
                if (modal.id === 'view-discuss-modal') currentDiscussionId = null;
            }
        });
    });

    // Image Viewer Modal Logic
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const imageViewerClose = document.getElementById('image-viewer-close');
    
    if (imageViewerClose && imageViewerModal) {
        imageViewerClose.addEventListener('click', () => {
            imageViewerModal.style.display = 'none';
        });

        imageViewerModal.addEventListener('click', (e) => {
            if (e.target === imageViewerModal) {
                imageViewerModal.style.display = 'none';
            }
        });
    }
});