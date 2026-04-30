// /admin/js/discuss.js
document.addEventListener('DOMContentLoaded', () => {
    const discussionsListContainer = document.getElementById('discussions-list');
    
    const detailModal = document.getElementById('discuss-detail-modal');
    const modalCloseBtns = detailModal.querySelectorAll('.close-btn');
    const btnDeleteDiscussion = document.getElementById('btn-delete-discussion');
    
    const detailTitle = document.getElementById('detail-title');
    const detailAuthor = document.getElementById('detail-author');
    const detailTime = document.getElementById('detail-time');
    const detailContent = document.getElementById('detail-content');
    const detailReplyCount = document.getElementById('detail-reply-count');
    const commentsContainer = document.getElementById('detail-comments-container');

    let currentDiscussionId = null;

    // Load tất cả thảo luận
    const loadDiscussions = () => {
        db.collection('discussions').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) {
                discussionsListContainer.innerHTML = '<tr><td colspan="5" style="text-align: center;">Chưa có câu hỏi nào.</td></tr>';
                return;
            }
            discussionsListContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const tr = document.createElement('tr');
                const date = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'Unknown';
                tr.innerHTML = `
                    <td><strong>${data.title}</strong></td>
                    <td>${data.author}</td>
                    <td>${date}</td>
                    <td>${data.replyCount || 0}</td>
                    <td>
                        <button class="btn btn-primary btn-sm btn-view" data-id="${doc.id}">Xem Chi Tiết</button>
                    </td>
                `;
                discussionsListContainer.appendChild(tr);
            });

            // Gắn event listener cho các nút "Xem chi tiết"
            document.querySelectorAll('.btn-view').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    openDetailModal(e.target.dataset.id);
                });
            });
        }, err => {
            console.error("Lỗi tải discussions:", err);
            discussionsListContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Lỗi tải dữ liệu.</td></tr>';
        });
    };

    loadDiscussions();

    const openDetailModal = async (id) => {
        currentDiscussionId = id;
        try {
            const doc = await db.collection('discussions').doc(id).get();
            if (!doc.exists) {
                alert("Câu hỏi không tồn tại!");
                return;
            }
            const data = doc.data();
            
            detailTitle.textContent = data.title;
            detailAuthor.textContent = data.author;
            detailTime.textContent = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'Unknown';
            detailContent.innerHTML = data.content;
            detailReplyCount.textContent = data.replyCount || 0;
            
            loadCommentsForModal(id);
            detailModal.style.display = 'block';
        } catch (error) {
            console.error("Lỗi mở chi tiết:", error);
        }
    };

    const loadCommentsForModal = (discussionId) => {
        commentsContainer.innerHTML = 'Đang tải bình luận...';
        db.collection('comments')
            .where('discussionId', '==', discussionId)
            // .orderBy('createdAt', 'asc') -> Bỏ qua orderBy tạm thời nếu chưa build Index
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    commentsContainer.innerHTML = '<p style="color: grey;">Không có bình luận nào.</p>';
                    return;
                }
                commentsContainer.innerHTML = '';
                
                let commentsArr = [];
                snapshot.forEach(doc => commentsArr.push({id: doc.id, ...doc.data()}));
                // Sort array locally
                commentsArr.sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

                commentsArr.forEach(data => {
                    const div = document.createElement('div');
                    div.style.cssText = 'border: 1px solid #dee2e6; padding: 10px; border-radius: 5px; margin-bottom: 10px; background: #fff;';
                    const date = data.createdAt ? data.createdAt.toDate().toLocaleString('vi-VN') : 'Unknown';
                    
                    // Hiển thị nội dung
                    let contentHtml = `<div class="ql-editor ql-snow" style="padding: 0;">${data.content}</div>`;
                    if (data.imageUrl) {
                        contentHtml += `<div style="margin-top: 10px;"><img src="${data.imageUrl}" style="max-height: 200px; border-radius: 8px;"></div>`;
                    }
                    const replyInfo = data.replyToAuthor ? ` <span style="color: #007bff; font-weight: normal; font-size: 0.9em;">(Trả lời: ${data.replyToAuthor})</span>` : '';

                    div.innerHTML = `
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">
                            <span style="font-size: 0.9em;"><strong>${data.author}</strong>${replyInfo} - <span style="color: grey;">${date}</span></span>
                            <span class="danger-text btn-delete-comment" data-cid="${data.id}" title="Xóa bình luận này!" style="cursor: pointer;">🗑️ Xóa</span>
                        </div>
                        ${contentHtml}
                    `;
                    commentsContainer.appendChild(div);
                });

                // Gắn listener cho nút xóa comment
                document.querySelectorAll('.btn-delete-comment').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const cid = e.target.dataset.cid;
                        deleteComment(cid, discussionId);
                    });
                });
            }, err => {
                console.error("Lỗi tải comments:", err);
                commentsContainer.innerHTML = '<p style="color: red;">Lỗi tải bình luận.</p>';
            });
    };

    // Modal close logic
    modalCloseBtns.forEach(btn => btn.addEventListener('click', () => {
        detailModal.style.display = 'none';
        currentDiscussionId = null;
    }));
    window.addEventListener('click', (e) => {
         if (e.target === detailModal) {
             detailModal.style.display = 'none';
             currentDiscussionId = null;
         }
    });

    // Xóa Bài thảo luận (và tất cả bình luận liên quan)
    btnDeleteDiscussion.addEventListener('click', async () => {
        if (!currentDiscussionId) return;
        if (!confirm('Bạn có CHẮC CHẮN muốn xóa câu hỏi này và TOÀN BỘ bình luận bên trong? Hành động này không thể hoàn tác.')) return;

        try {
            // Lấy tất cả comment của discussion này để xóa
            const commentsSnap = await db.collection('comments').where('discussionId', '==', currentDiscussionId).get();
            
            const batch = db.batch();
            
            // Đưa task xóa documents comment vào batch
            commentsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Xóa document discussion
            batch.delete(db.collection('discussions').doc(currentDiscussionId));

            await batch.commit();

            alert('Đã xóa câu hỏi và bình luận thành công!');
            detailModal.style.display = 'none';
            currentDiscussionId = null;
        } catch (error) {
            console.error("Lỗi xóa thảo luận:", error);
            alert("Đã xảy ra lỗi khi xóa!");
        }
    });

    // Xóa Comment lẻ
    const deleteComment = async (commentId, discussionId) => {
        if (!confirm('Bạn muốn xóa bình luận này?')) return;
        try {
            const batch = db.batch();
            // Xóa comment
            batch.delete(db.collection('comments').doc(commentId));
            
            // Trừ replyCount trong discussion
            const discussionRef = db.collection('discussions').doc(discussionId);
            batch.update(discussionRef, {
                replyCount: firebase.firestore.FieldValue.increment(-1)
            });

            await batch.commit();
            // Snapshot sẽ tự động cập nhật UI
        } catch (error) {
            console.error("Lỗi xóa comment:", error);
            alert("Đã xảy ra lỗi khi xóa bình luận!");
        }
    }
});
