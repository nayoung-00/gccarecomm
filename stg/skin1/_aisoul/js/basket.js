$(function () {
    const itemCheckboxSelector = '.ec-base-prdInfo.gCheck > .prdBox > input.check';
    const selectAllSelector = '#product_select_all';
    let isSelectAllChanging = false;
    let syncTimer = null;

    function updateSelectAllCheckbox() {
        const $itemCheckboxes = $(itemCheckboxSelector);
        const checkedCount = $itemCheckboxes.filter(':checked').length;

        const isAllChecked = $itemCheckboxes.length > 0 && checkedCount === $itemCheckboxes.length;
        $(selectAllSelector).prop('checked', isAllChecked).attr('data-status', isAllChecked ? 'on' : 'off');
    }
    document.addEventListener('click',function (event) {
            if (!event.target.matches(selectAllSelector)) {
                return;
            }
            isSelectAllChanging = true;
            clearTimeout(syncTimer);
            syncTimer = setTimeout(function () {
                isSelectAllChanging = false;
                updateSelectAllCheckbox();
            }, 0);
        }, true
    );
    $(document).on('change.basketSelectAll',
        itemCheckboxSelector,function () {
            if (isSelectAllChanging) {
                return;
            }
            clearTimeout(syncTimer);
            syncTimer = setTimeout(function () {
                updateSelectAllCheckbox();
            }, 0);
        }
    );

    updateSelectAllCheckbox();
});