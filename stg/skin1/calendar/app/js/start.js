async function CAC_START() {
  const calendarWrap = CAC.getRoot().querySelector('#calendar_wrap');

  const hideCalendar = (message, isError = false, errorObj = null) => {
    if (message) {
      logMessage(message, isError, errorObj);
    }
    calendarWrap.remove();
  };

  setupCalendarWrap(calendarWrap);

  if (!(await initCafe24API(hideCalendar))) return;
  if (!(await prepareCalendarData(hideCalendar))) {
    return hideCalendar('캘린더 초기화 실패');
  }

  showCalendar(calendarWrap);
  renderCalendar();
  CAC_VIEW.DOMContentLoaded();
}

async function CAC_LIST_START() {

  await CAC_CAFE24API.init();

  CAC_LIST_VIEW.groupId = CAC.currentElement.getAttribute('group-id');
  CAC_VIEW.groupId = CAC_LIST_VIEW.groupId;
  try {
    !CAC_UTIL.isEcEditor() && (await CAC_CAFE24API.setEncryptedToken());

    const setting = await CAC_CAFE24API.getSetting();
    if (!setting) {
      throw new Error('setting ERROR: 설정 정보가 없습니다.');
    }

    CAC_LIST_VIEW.basic_setting = setting?.basic_setting;
    CAC_LIST_VIEW.calendar_group = setting?.group_list;

    if (CAC_LIST_VIEW.groupId === null && setting?.basic_setting?.use_front === 'F') {
      throw new Error('캘린더 기본설정 노출안함');
    }

    if (!!CAC_LIST_VIEW.groupId && Object.keys(setting.group_list).length === 0) {
      throw new Error('캘린더 그룹코드가 없습니다.');
    }

    if (!CAC_UTIL.isEcEditor() && !CAC_LIST_VIEW.checkPermission()) {
      throw new Error('접근권한이 없습니다. 관리자에게 문의하세요.');
    }

    let currentViewType = '';
    if (CAC_LIST_VIEW.groupId) {
      const groupSetting = setting?.group_list.find((group) => group._id === CAC_LIST_VIEW.groupId);
      if (groupSetting?.use_single_calendar === 'F') {
        console.log('단독 캘린더 사용 안함');
        return;
      }
      currentViewType = groupSetting?.single_calendar_front_calendar_view_type ?? 'month_view';
      CAC_LIST_VIEW.currentSetting = groupSetting;
    } else {
      currentViewType = setting?.basic_setting?.front_calendar_view_type ?? 'month_view';
      CAC_LIST_VIEW.currentSetting = setting?.basic_setting;
    }

    document.querySelector('#container')?.style.setProperty('position', 'static', 'important');

    CAC_LIST_VIEW.DOMContentLoaded(currentViewType);
  } catch (error) {
    console.log(error.message);
    CAC.getRoot().querySelector('#calendar_wrap').remove();
  }
}

function setupCalendarWrap(calendarWrap) {
  Object.assign(calendarWrap.style, {
    backgroundColor: '#ffffff',
    display: 'none',
  });
}

function logMessage(message, isError, errorObj) {
  if (isError) {
    CAC_VIEW.isDev && console.error(message, errorObj ?? '');
  } else {
    console.log(message);
  }
}

async function initCafe24API(hideCalendar) {
  try {
    await CAC_CAFE24API.init();
    return true;
  } catch (e) {
    hideCalendar('CAFE24API 초기화 실패: ', true, e);
    return false;
  }
}

async function prepareCalendarData(hideCalendar) {
  try {
    CAC_VIEW.groupId = CAC.currentElement.getAttribute('group-id');
    if (!CAC_UTIL.isEcEditor()) await CAC_CAFE24API.setEncryptedToken();

    const config = await CAC_DATA.loadConfigData();
    if (!config) return false;

    CAC_VIEW.calendarGroupList = config.group_list || null;
    CAC_VIEW.basicSetting = config.basic_setting || null;

    if (shouldHideCalendar()) return false;

    CAC_VIEW.holiday = await CAC_DATA.loadHolidayData();
    CAC_VIEW.setCalendarTitle();
    CAC_VIEW.setCalendarGroup();

    return true;
  } catch {
    return false;
  }
}

function shouldHideCalendar() {
  return (
      isInvalidGroupId() ||
      isMissingGroupCode() ||
      isNoPermission()
  );
}

function isInvalidGroupId() {
  return CAC_VIEW.group_id === null &&
      CAC_VIEW?.basic_setting?.use_front === 'F';
}

function isMissingGroupCode() {
  return !!CAC_VIEW.group_id &&
      Object.keys(CAC_VIEW.calendarGroupList || {}).length === 0;
}

function isNoPermission() {
  return !CAC_UTIL.isEcEditor() &&
      !CAC_VIEW.checkPermission();
}

function showCalendar(calendarWrap) {
  calendarWrap.style.display = 'block';
}

function renderCalendar() {
  CAC_UTIL.isMobile()
      ? CAC_VIEW.renderCalendarMobile()
      : CAC_VIEW.renderCalendar();
}