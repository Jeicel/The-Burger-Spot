// Lightweight UI helpers (confirm modal)
(function(){
    // Create modal markup once
    const tpl = document.createElement('div');
    tpl.innerHTML = `
        <div id="gsu-confirm-backdrop" class="gsu-modal-backdrop hidden" aria-hidden="true">
            <div class="gsu-modal" role="dialog" aria-modal="true" aria-labelledby="gsu-confirm-title">
                <div class="gsu-modal-body">
                    <h3 id="gsu-confirm-title" class="gsu-modal-title"></h3>
                    <div id="gsu-confirm-message" class="gsu-modal-message"></div>
                </div>
                <div class="gsu-modal-actions">
                    <button id="gsu-confirm-cancel" class="btn btn-outline">Cancel</button>
                    <button id="gsu-confirm-ok" class="btn btn-primary">OK</button>
                </div>
            </div>
        </div>
    `;

    // Append to body
    const modalRoot = tpl.firstElementChild;
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(modalRoot);
    });

    // Helper to toggle
    function openModal({title = 'Confirm', message = '', okText = 'OK', cancelText = 'Cancel'} = {}){
        return new Promise((resolve) => {
            const backdrop = document.getElementById('gsu-confirm-backdrop');
            const titleEl = document.getElementById('gsu-confirm-title');
            const msgEl = document.getElementById('gsu-confirm-message');
            const okBtn = document.getElementById('gsu-confirm-ok');
            const cancelBtn = document.getElementById('gsu-confirm-cancel');

            if (!backdrop || !titleEl || !msgEl || !okBtn || !cancelBtn) {
                // Fallback to native confirm
                const result = window.confirm(message || title);
                return resolve(!!result);
            }

            titleEl.textContent = title;
            msgEl.innerHTML = typeof message === 'string' ? message : '';
            okBtn.textContent = okText;
            cancelBtn.textContent = cancelText;

            function cleanup() {
                backdrop.classList.add('hidden');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                backdrop.removeEventListener('click', onBackdrop);
                document.removeEventListener('keydown', onKey);
            }

            function onOk(e){ e.stopPropagation(); cleanup(); resolve(true); }
            function onCancel(e){ e.stopPropagation(); cleanup(); resolve(false); }
            function onBackdrop(e){ if (e.target === backdrop) { cleanup(); resolve(false); } }
            function onKey(e){ if (e.key === 'Escape') { cleanup(); resolve(false); } }

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            backdrop.addEventListener('click', onBackdrop);
            document.addEventListener('keydown', onKey);

            backdrop.classList.remove('hidden');
            // focus OK by default
            setTimeout(() => okBtn.focus(), 50);
        });
    }

    // Expose globally
    window.showConfirmModal = openModal;
})();
