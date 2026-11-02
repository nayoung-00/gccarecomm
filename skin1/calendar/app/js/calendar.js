const CAC_VIEW = {
  isDev: true, // 개발모드
  calendar: null, // 캘린더 DOM
  basic_setting: null, // 기본설정
  calendar_list: null, // 캘린더 데이터
  calendar_group_list: null, // 캘린더 그룹 데이터
  promotion_data: null, // 마켓프로모션 데이터
  season_data: null, // 시즌이벤트 데이터
  group_id: null, // 캘린더 그룹코드
  holiday: null, // 공휴일
  debounceSearch: null, // 검색 디바운스
  token: null, // 토큰
  member_id: null, // 멤버아이디
  group_no: null, // 그룹번호

  set basicSetting(value) {
    this.basic_setting = value;
  },

  set calendarList(value) {
    this.calendar_list = value;
  },
  get calendarList() {
    if (this.group_id) {
      return this.calendar_list.filter((event) => event.calendar_group_id === this.group_id);
    }
    return this.calendar_list;
  },

  set calendarGroupList(value) {
    this.calendar_group_list = value;
  },
  get calendarGroupList() {
    if (this.group_id) {
      return this.calendar_group_list.filter(
        (group) => group._id === this.group_id && group.use_single_calendar === 'T',
      );
    } else {
      // calendar_group
      const calendarGroup = this.calendar_group_list
        .filter((group) => group.category === 'MY' && group.type === 'MY' && group.display_front === 'T')
        .sort((a, b) => {
          return a.sort - b.sort;
        });

      // 시즌 이벤트
      const seasonEventGroup = this.calendar_group_list
        .filter((group) => group.category === 'SEASON' && group.type === 'SEASON_EVENT' && group.display_front === 'T')
        .sort((a, b) => {
          return a.sort - b.sort;
        });

      // 마켓프로모션
      const promotionGroup = this.calendar_group_list
        .filter(
          (group) => group.category === 'PROMOTION' && group.type === 'MARKET_PROMOTION' && group.display_front === 'T',
        )
        .sort((a, b) => {
          return a.sort - b.sort;
        });

      return [...calendarGroup, ...seasonEventGroup, ...promotionGroup];
    }
  },
  set groupId(value) {
    this.group_id = value;
  },

  set holidayList(value) {
    this.holiday = value;
  },
  get holidayList() {
    return this.holiday;
  },

  get eventList() {
    const eventList = [];
    this.calendar_list &&
      this.calendarList.forEach((event) => {
        if (this.group_id && event.calendar_group_id !== this.group_id) {
          return;
        }

        const group = this.calendarGroupList.find((group) => group._id === event.calendar_group_id);
        eventList.push({
          ...event,
          title: he.decode(event.title),
          color: group?.group_color ?? '',
          id: event._id,
          start: event.is_day === 'T' ? moment(event.start_datetime).format('YYYY-MM-DD') : event.start_datetime || '',
          end:
            !moment(event.end_datetime).isSame(moment(event.start_datetime), 'day') || event.is_day === 'T'
              ? moment(event.end_datetime).add(1, 'day').format('YYYY-MM-DD')
              : event.end_datetime || '',
          groupId: event.calendar_group_id || '',
          allDay: !moment(event.end_datetime).isSame(moment(event.start_datetime), 'day') || event.is_day === 'T',
          is_promotion: false,
        });
      });
    return eventList;
  },

  // 캘린더 데이터를 파싱하여 이벤트 리스트로 반환
  parseEvent(calendarList) {
    const eventList = [];
    calendarList.forEach((event) => {
      if (this.group_id && event.calendar_group_id !== this.group_id) {
        return;
      }

      const group = this.calendarGroupList.find((group) => group._id === event.calendar_group_id);
      eventList.push({
        ...event,
        title: he.decode(event.title),
        color: group?.group_color ?? '',
        id: event._id,
        start: event.is_day === 'T' ? moment(event.start_datetime).format('YYYY-MM-DD') : event.start_datetime || '',
        end:
          !moment(event.end_datetime).isSame(moment(event.start_datetime), 'day') || event.is_day === 'T'
            ? moment(event.end_datetime).add(1, 'day').format('YYYY-MM-DD')
            : event.end_datetime || '',
        groupId: event.calendar_group_id || '',
        allDay: !moment(event.end_datetime).isSame(moment(event.start_datetime), 'day') || event.is_day === 'T',
        is_promotion: false,
      });
    });
    return eventList;
  },

  parsePromotionEvent(promotionData) {
    const promotionGroup = this.calendarGroupList.find(
      (group) => group.category === 'PROMOTION' && group.type === 'MARKET_PROMOTION',
    );

    if (!promotionGroup) return;
    const promotionList = [];
    promotionData.forEach((item) => {
      if (promotionGroup?.includes?.includes(item.market_code) === false) return;

      promotionList.push({
        _id: item.board_no,
        id: item.board_no,
        description: item.body,
        title: `[${item.market_name}] ${he.decode(item.promotion_title?.trim() ?? '') || he.decode(item.title?.trim() ?? '')}`,
        color: promotionGroup?.group_color || '',
        is_promotion: true,
        start_datetime: item.market_reg_timestamp,
        end_datetime: item.market_reg_timestamp,
        start: item.market_reg_timestamp,
        end: item.market_reg_timestamp,
        is_day: 'F',
        allDay: true,
        is_complete: 'F',
        is_important: 'F',
        calendar_group_id: promotionGroup?._id,
        calendar_group_category: 'PROMOTION',
        calendar_group_type: 'MARKET_PROMOTION',
      });
    });
    return promotionList;
  },

  parseSeasonEvent(seasonEventData) {
    const seasonEventList = [];
    const seasonEventGroup = this.calendarGroupList.find(
      (group) => group.category === 'SEASON' && group.type === 'SEASON_EVENT',
    );
    if (!seasonEventGroup) return;

    seasonEventData.forEach((item) => {
      if (seasonEventGroup?.includes?.includes(item.type) === false) return;

      seasonEventList.push({
        _id: item.id,
        id: item.id,
        title: he.decode(item.title),
        color: seasonEventGroup?.group_color || '',
        is_promotion: true,
        start_datetime: item.start_datetime,
        end_datetime: item.end_datetime ? item.end_datetime : item.start_datetime,
        start: item.start_datetime,
        end: item.end_datetime ? moment(item.end_datetime).add(1, 'day').format('YYYY-MM-DD') : '',
        is_day: 'T',
        allDay: true,
        is_complete: item.is_complete ?? 'F',
        is_important: item.is_important ?? 'F',
        calendar_group_id: seasonEventGroup?._id,
        calendar_group_category: 'SEASON',
        calendar_group_type: 'SEASON_EVENT',
      });
    });
    return seasonEventList;
  },

  // 접근권한 체크
  checkPermission: function () {
    const isMallOwner = this.member_id === CAFE24API.MALL_ID;
    if (isMallOwner) return true;

    const hasPermission = (permissionFlag, permissionList) => {
      if (permissionFlag !== 'T') return true;
      return permissionList?.some(item => item.group_no === CAC_VIEW.group_no) ?? false;
    };

    if (this.group_id === null) {
      return hasPermission(
          this.basic_setting?.front_use_permission,
          this.basic_setting?.front_permission
      );
    }

    const group = this.calendarGroupList.find(g => g._id === this.group_id);
    return hasPermission(
        group?.single_calendar_use_front_permission,
        group?.single_calendar_front_permission
    );
  },

  // 캘린더 타이틀
  setCalendarTitle: function () {
    if (this.group_id == null || this.group_id === '') {
      // 전체 캘린더명 설정
      const groupCalendarName = CAC_CAFE24API.getSiteName() ?? '';
      CAC$('.eShopName', CAC.getRoot()).text(`${he.decode(groupCalendarName)} 캘린더`);
    } else {
      // 단독 캘린더 그룹명
      const groupCalendarName =
        this.calendarGroupList[0]?.use_front_group_name === 'T'
          ? this.calendarGroupList[0]?.front_group_name
          : this.calendarGroupList[0]?.group_name;

      // 단독 캘린더명 설정
      CAC$('.eShopName', CAC.getRoot()).text(`${he.decode(groupCalendarName) || ''} 캘린더`);
    }
  },
  // 캘린더 그룹
  setCalendarGroup: function () {
    CAC$('.calendar_filter .calendar_list', CAC.getRoot()).html('');
    if (this.calendarGroupList.length === 0) {
      CAC$('.calendar_filter .btn_select', CAC.getRoot()).css('padding-right', '0px');
      CAC$('.calendar_filter .btn_select', CAC.getRoot()).css('height', '28px');
      CAC$('.calendar_filter .calendar_list_wrap', CAC.getRoot()).remove();

      // .calendar_filter > button  remove btn_select class
      CAC$('.calendar_filter > button', CAC.getRoot()).removeClass('btn_select');

      return;
    }

    let groupHtml = '';
    this.calendarGroupList.forEach(function (item) {
      let group = document.createElement('div');
      group.classList.add('calendar_group');
      group.setAttribute('group-code', item.group_code);
      groupHtml += `
				<li>
					<label class="label_ckeck">
						<input type="checkbox" class="event_filter" name="event_filter" data-type="group" id="${item._id}" value="${item._id}" checked>
						<span class="check_mark
						" style="background:${item.group_color}; border-color:${item.group_color}"></span>
						<span class="check_text">${item.use_front_group_name === 'T' ? item.front_group_name : item.group_name}</span>
					</label>
				</li>
			`;
    });

    CAC$('.calendar_filter .calendar_list', CAC.getRoot()).html(groupHtml);
  },

  getStartCalendar: function (source) {
    return CAC_UTIL.isMobile()
      ? source?.single_calendar_front_start_calendar_mobile || source?.front_start_calendar_mobile
      : source?.single_calendar_front_start_calendar || source?.front_start_calendar;
  },

  /**
   * 초기 뷰 설정
   * @returns {string}
   */
  computedInitialView: function () {
    let startCalendar;
    // 단독캘린더시
    if (this.group_id) {
      const calendarGroup = this.calendarGroupList.find((group) => group._id === this.group_id);
      startCalendar = this.getStartCalendar(calendarGroup);
    } else {
      startCalendar = this.getStartCalendar(this.basic_setting);
    }

    switch (startCalendar) {
      case 'W':
        return 'timeGridWeek';
      case 'D':
        return 'timeGridDay';
      default:
        return 'dayGridMonth';
    }
  },

  /**
   * 시작 요일 설정
   * @returns {number}
   */
  getStartWeek: function (source) {
    return source?.single_calendar_front_start_week || source?.front_start_week;
  },
  computedStartWeek: function () {
    let startWeek;
    // 단독캘린더시
    if (this.group_id) {
      const calendarGroup = this.calendarGroupList.find((group) => group._id === this.group_id);
      startWeek = this.getStartWeek(calendarGroup);
    } else {
      startWeek = this.getStartWeek(this.basic_setting);
    }

    return startWeek.toString() === 'M' ? 1 : 0;
  },

  /**
   * 표시 제한 설정
   * @returns {*|number}
   */
  computedDisplayLimit: function () {
    return this.basic_setting?.display_limit || 999;
  },

  /**calendar_list sorting */
  sortCalendarList: function (a, b) {
    // 1. 프로모션 여부 비교
    if (a?.is_promotion && !b?.is_promotion) {
      return 1;
    } else if (!a?.is_promotion && b?.is_promotion) {
      return -1;
    }

    // 2. 종일 여부 비교
    if (a?.is_day === 'T' && b?.is_day === 'F') {
      return -1;
    } else if (a?.is_day === 'F' && b?.is_day === 'T') {
      return 1;
    }

    return moment(a?.start_datetime).isBefore(moment(b?.start_datetime)) ? -1 : 1;
  },

  datesSetHandler: async function (dateInfo) {
    if (CAC_VIEW.calendarGroupList.length === 0) return;

    const { beginDate, endDate, beginDateTime, endDateTime } = this.getDateRanges(dateInfo);

    // 월달이동시 원격데이터 요청
    this.calendarList = await this.loadCalendarList(beginDateTime, endDateTime);

    // 마켓프로모션 데이터 요청
    CAC_VIEW.promotion_data = await this.loadPromotionData(beginDate, endDate);

    // 시즌 이벤트 데이터 요청
    CAC_VIEW.season_data = await this.loadSeasonEventData(beginDate, endDate);

    // 새 이벤트를 기존 이벤트에 추가
    this.calendar_list = [...this.calendarList];

    // 이벤트 필터 적용
    this.applyEventFilter();
  },

  /** 날짜 범위 계산 */
  getDateRanges: function (dateInfo) {
    const beginDate = moment(dateInfo.start).format('YYYY-MM-DD');
    const endDate = moment(dateInfo.end).format('YYYY-MM-DD');

    return {
      beginDate,
      endDate,
      beginDateTime: beginDate + ' 00:00',
      endDateTime: endDate + ' 23:59',
    };
  },

  /** 캘린더 리스트 로딩 */
  loadCalendarList: async function (beginDateTime, endDateTime) {
    const calendar_list = await CAC_DATA.loadRemoteCalendarData(beginDateTime, endDateTime);
    if (!calendar_list?.lists) return [];

    return this.group_id
        ? calendar_list.lists
        : calendar_list.lists.filter((item) => item.display_front !== 'F');
  },

  /** 프로모션 데이터 로딩 */
  loadPromotionData: async function (beginDate, endDate) {
    const promotionGroup = this.calendarGroupList.find(
        (group) => group.category === 'PROMOTION' && group.type === 'MARKET_PROMOTION'
    );

    if (!promotionGroup) return [];

    if (!this.group_id && promotionGroup.display_front !== 'T') return [];

    const promotionRemoteData =
        (await CAC_DATA.loadMarketPromotionData(beginDate, endDate)) || [];

    const filteredData = this.group_id
        ? promotionRemoteData
        : promotionRemoteData.filter((item) => item.display_front !== 'F');

    return CAC_VIEW.parsePromotionEvent(filteredData);
  },

  /** 시즌 이벤트 데이터 로딩 */
  loadSeasonEventData: async function (beginDate, endDate) {
    const seasonEventGroup = this.calendarGroupList.find(
        (group) => group.category === 'SEASON' && group.type === 'SEASON_EVENT'
    );

    if (!seasonEventGroup) return [];

    const seasonEventRemoteData = await CAC_DATA.loadSeasonEventData(beginDate, endDate);

    const filteredData = this.group_id
        ? seasonEventRemoteData
        : seasonEventRemoteData.filter((item) => item.display_front !== 'F');

    return CAC_VIEW.parseSeasonEvent(filteredData);
  },
  /** 그룹 영역 빌드 */
  buildGroups: function (data) {
    const {layer, is_promotion, calendar_group_id, eventId, title, start_datetime, end_datetime, is_day} = data

    if (!is_promotion) {
      CAC_VIEW.renderThirdPartyCalGroups(
          layer, calendar_group_id || '', eventId || '', title,
          start_datetime || '', end_datetime || '', is_day || 'F'
      );
    } else {
      layer.find('.calendar_groups').html('');
    }
  },

  /** 날짜 영역 빌드 */
  buildDate: function (layerCont, start, end, isDay, eventEnd) {
    let dateText = '';
    if (isDay === 'T') {
      const sameDay = moment(start).isSame(end, 'day') || eventEnd === null;
      dateText = sameDay
          ? moment(start).format('YYYY-MM-DD')
          : `${moment(start).format('YYYY-MM-DD')} ~ ${moment(end).format('YYYY-MM-DD')}`;
    } else {
      dateText = `${moment(start).format('YYYY-MM-DD HH:mm')} ~ ${moment(end).format('YYYY-MM-DD HH:mm')}`;
    }
    layerCont.append(`<div class="date">${dateText}</div>`);
  },

  /** 이미지 빌드 */
  buildImages: async function (layerCont, eventImage) {
    if (!Array.isArray(eventImage) || eventImage.length === 0) return;
    let imagesHTML = '';
    for (const item of eventImage) {
      const html = await CAC_VIEW.renderProductDetailView(item);
      if (html) imagesHTML += html;
    }
    if (imagesHTML) {
      layerCont.append(`<div class="image"><ul>${imagesHTML}</ul></div>`);
    }
  },

  /** 카테고리 빌드 */
  buildCategories: async function (layerCont, eventCategories) {
    if (!Array.isArray(eventCategories) || eventCategories.length === 0) return;
    const categoriesHTML = await CAC_VIEW.generateCategoriesHTML(eventCategories);
    if (categoriesHTML) {
      layerCont.append(categoriesHTML);
    }
  },

  /** 게시글 빌드 */
  buildBoard: function (layerCont, eventBoard) {
    if (!eventBoard || typeof eventBoard !== 'object' || Object.keys(eventBoard).length === 0) return;
    const urlHTML = `<a href="${CAC_VIEW.getBoardLink(
        eventBoard.board_name, eventBoard.board_no, eventBoard.article_no
    )}" target="_blank">${eventBoard?.title}</a>`;
    layerCont.append(`<div class="board">${urlHTML}</div>`);
  },

  /** HTML 이스케이프 (XSS 방어) */
  escapeHtml: function (str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
  },

  /** URL 빌드 */
  buildUrl: function (layerCont, eventUrl) {
    if (!eventUrl) return;
    const hrefUrl = /^(http|https):\/\//.test(eventUrl) ? eventUrl : 'https://' + eventUrl;
    const safeHref = CAC_VIEW.escapeHtml(hrefUrl);
    const safeText = CAC_VIEW.escapeHtml(eventUrl);
    layerCont.append(`<div class="url"><a href="${safeHref}" target="_blank">${safeText}</a></div>`);
  },

  /** 설명 빌드 */
  buildDescription: function (layerCont, description) {
    if (!description) return;
    layerCont.append(`<div class="description fr-view">${description}</div>`);
  },

  conversion: function (date) {
    if (!date) return null;
    moment.locale('ko');
    return moment(date).format('YYYY-MM-DD hh:mm');
  },
  // 일반 캘린더 (pc)
  renderCalendar: function () {
    // 일반 캘린더
    let calendarEl = CAC.getRoot().getElementById('calendar');
    let calendar = new FullCalendar.Calendar(calendarEl, {
      locale: 'ko',
      buttonText: {
        today: '오늘',
        month: '월',
        week: '주',
        day: '일',
        list: 'list',
      },
      titleFormat: {
        year: 'numeric',
        month: 'long',
        //day: 'numeric'
      },
      dayHeaderFormat: {
        weekday: 'long',
      },
      dayHeaderContent: (args) => {
        let headerDay = document.createElement('span');
        let headerWeek = document.createElement('span');

        headerDay.classList.add('date');

        if (args.view.type === 'timeGridDay' || args.view.type === 'timeGridWeek') {
          if (moment(args.date).format('YYYY-MM-DD') in CAC_VIEW.holiday) {
            headerDay.style.color = 'red';
            headerWeek.style.color = 'red';
          }
          headerDay.innerHTML =
            args.view.type === 'timeGridDay'
              ? moment(args.date).format('Do').replace('일', '')
              : moment(args.date).format('Do');
          headerWeek.innerHTML =
            args.view.type === 'timeGridDay' ? moment(args.date).format(' dd') : moment(args.date).format(' (dd)');
          return {
            html: headerDay.outerHTML + headerWeek.outerHTML,
          };
        } else if (args.view.type === 'dayGridMonth') {
          return moment(args.date).format('dddd');
        }
      },
      dayCellContent: (info) => {
        let number = document.createElement('a');
        number.classList.add('fc-daygrid-day-number');
        number.innerHTML = info.dayNumberText.replace('일', '').replace('日', '');

        let holidayEl = document.createElement('span');
        holidayEl.style.color = 'red';

        // 공휴일 설정
        if (CAC_VIEW.holiday) {
          if (moment(info.date).format('YYYY-MM-DD') in CAC_VIEW.holiday) {
            holidayEl.innerHTML = CAC_VIEW.holiday[moment(info.date).format('YYYY-MM-DD')];
            number.style.color = 'red';
          }
        }

        if (info.view.type === 'dayGridMonth') {
          return {
            html: number.outerHTML + holidayEl.outerHTML,
          };
        }
        return {
          domNodes: [],
        };
      },
      // style
      initialView: this.computedInitialView(),
      height: 'auto',
      slotMinTime: '00:00',
      slotMaxTime: '24:00',
      navLinks: false, // 요일, 날짜 클릭 시 일/주 단위 화면으로 넘어감
      expandRows: true,
      editable: false, // 드래그 수정 여부
      selectable: false, //
      nowIndicator: true, //
      showNonCurrentDates: true, // 이전, 다음 달 날짜 표시
      fixedWeekCount: false,
      datesSet: function (dateInfo) {
        CAC_VIEW.datesSetHandler(dateInfo);
      },
      eventOrder: ['-is_promotion', '-is_day', 'start_datetime', 'end_datetime'],
      slotEventOverlap: false,
      firstDay: this.computedStartWeek(),
      dayMaxEvents: this.computedDisplayLimit(), // "more" 표시 전 최대 이벤트 갯수. true - 셀 높이에 따라 결정
      eventMaxStack: this.computedDisplayLimit(),
      scrollTime:
        (this.computedInitialView() === 'timeGridDay' || this.computedInitialView() === 'timeGridWeek') &&
        moment().subtract(8, 'hover').format('HH:mm:ss'),

      eventDisplay: 'block',

      headerToolbar: {
        left: '',
        center: 'prev,title,next,today',
        right: 'timeGridDay,timeGridWeek,dayGridMonth',
      },

      ///event layer
      eventClick: async (info) => {
        info.jsEvent.preventDefault();
        CAC$('.fc-more-popover', CAC.getRoot()).remove();

        const { event } = info;
        const props = event.extendedProps || {};
        const {
          description, external_link_url: eventUrl, link_board_article: eventBoard,
          link_products: eventImage, link_categories: eventCategories,
          is_promotion, calendar_group_id, _id, start_datetime, end_datetime, is_day
        } = props;
        const title = event.title;

        const layer = CAC$('#layerCalendarEvent', CAC.getRoot());
        const layerTitle = layer.find('h1');
        const layerCont = layer.find('.cont');

        // 초기화
        layer.css('display', 'block');
        layerTitle.text(title);
        layerCont.find('div').remove();

        const groupParam = {layer, is_promotion, calendar_group_id, eventId: _id, title, start_datetime, end_datetime, is_day}
        // 빌드 실행
        this.buildGroups(groupParam);

        this.buildDate(layerCont, start_datetime, end_datetime, is_day, event.end);
        await this.buildImages(layerCont, eventImage);
        await this.buildCategories(layerCont, eventCategories);
        this.buildBoard(layerCont, eventBoard);
        this.buildUrl(layerCont, eventUrl);
        this.buildDescription(layerCont, description);
      },
      eventContent: (info) => {
        let titleProfix = '';
        if (info.event.extendedProps.is_day !== 'T' && info.event.extendedProps.is_promotion !== true) {
          titleProfix = moment(info.event.extendedProps.start_datetime).format('A hh:mm');
        }

        let dom = null;

        dom = document.createElement('div');
        dom.className = 'fc-event-title';
        dom.style.padding = '2px';
        dom.style.cursor = 'pointer';

        if (info.event.extendedProps.is_complete === 'T') {
          const del = document.createElement('del');
          del.innerText = `${titleProfix} ${info.event.title}`;
          dom.appendChild(del);
        } else {
          dom.innerText = `${titleProfix} ${info.event.title}`;
        }

        return {
          domNodes: [dom],
        };
      },
      eventClassNames: function (info) {
        let result = true;
        let groups = [];
        CAC.getRoot()
          .querySelectorAll('input[name="event_filter"]:checked')
          .forEach(function (item) {
            const type = item.getAttribute('data-type');
            if (type === 'group') {
              groups.push(item.value);
            }
          });

        // 체크 된 일정 클래스 추가
        if (groups.length > 0) {
          result = result && groups.indexOf(info.event.extendedProps?.calendar_group_id) >= 0;
        } else {
          result = false;
        }

        // 체크되지 않은 일정 클래스 추가
        if (!result) {
          result = 'filter-hidden';
        }

        return result;
      },
      events: [],
      moreLinkClick: (info) => {
        CAC_VIEW.layerPopupCloseAll();
      },
      moreLinkDidMount: (info) => {
        // popover가 마운트된 후 실행되는 콜백
        const observer = new MutationObserver((mutations) => {
          const popover = CAC.getRoot().querySelector('.fc-popover');
          if (!popover) return;

          // 추가된 노드가 있는지 확인
          const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
          if (!hasAddedNodes) return;

          // 모든 이벤트 요소에 title 속성 추가
          popover.querySelectorAll('.fc-event').forEach(eventEl => {
            const titleEl = eventEl.querySelector('.fc-event-title');
            if (titleEl) {
              eventEl.setAttribute('title', titleEl.textContent || '');
            }
          });
        });

        // DOM 변화 감지 시작
        observer.observe(CAC.getRoot(), {
          childList: true,
          subtree: true,
        });

        // 컴포넌트 언마운트 시 observer 정리
        return () => observer.disconnect();
      },
    });

    calendar.render();

    CAC.getRoot()
      .querySelectorAll('input[name="event_filter"]')
      .forEach(function (item) {
        item.addEventListener('change', function () {
          CAC_VIEW.applyEventFilter();
        });
      });

    this.calendar = calendar;
  },

  renderCalendarMobile: function (initialView) {
    let calendarEl = CAC.getRoot().getElementById('calendar');
    let calendar = new FullCalendar.Calendar(calendarEl, {
      locale: 'ko',
      buttonText: {
        today: '오늘',
        month: '월',
        week: '주',
        day: '일',
        list: 'list',
      },
      titleFormat: {
        month: 'long',
        year: 'numeric',
      },
      views: {
        timeGridWeek: {
          titleFormat: function (date) {
            const start = moment(date.start);
            const end = moment(date.end); // 마지막 날짜 보정

            if (start.year() !== end.year()) {
              return `${start.format('M월')} - ${end.format('YYYY년 M월')}`;
            }

            if (start.month() !== end.month()) {
              return `${start.format('YYYY년 M월')} - ${end.format('M월')}`;
            }

            return start.format('YYYY년 M월');
          },
        },
      },
      dayHeaderFormat: {
        weekday: 'short',
      },
      dayHeaderContent: (args) => {
        let headerDay = document.createElement('span');
        let headerWeek = document.createElement('span');

        headerDay.classList.add('date');

        headerDay.innerHTML = moment(args.date).format('Do').replace('일', '');
        headerWeek.innerHTML = moment(args.date).format(' dd');

        if (args.view.type === 'timeGridDay' || args.view.type === 'timeGridWeek') {
          if (moment(args.date).format('YYYY-MM-DD') in CAC_VIEW.holiday) {
            headerDay.style.color = 'red';
            headerWeek.style.color = 'red';
          }
          return {
            html: headerDay.outerHTML + headerWeek.outerHTML,
          };
        } else if (args.view.type === 'dayGridMonth') {
          return moment(args.date).format('dd');
        }
      },
      dayCellContent: (info) => {
        let number = document.createElement('a');
        number.classList.add('fc-daygrid-day-number');
        number.innerHTML = info.dayNumberText.replace('일', '').replace('日', '');

        if (info.view.type === 'dayGridMonth') {
          // 공휴일 설정
          if (moment(info.date).format('YYYY-MM-DD') in CAC_VIEW.holiday) {
            number.style.color = 'red';
          }
          return {
            html: number.outerHTML,
          };
        }
        return {
          domNodes: [],
        };
      },

      // style
      initialView: this.computedInitialView(),
      height: '700px',
      slotMinTime: '00:00',
      slotMaxTime: '24:00',
      navLinks: false, // 요일, 날짜 클릭 시 일/주 단위 화면으로 넘어감
      expandRows: true,
      editable: false, // 드래그 수정 여부
      selectable: false, //
      nowIndicator: true, //
      dayMaxEvents: this.computedDisplayLimit(),
      eventMaxStack: this.computedDisplayLimit(),
      eventDisplay: 'block',
      showNonCurrentDates: true, // 이전, 다음 달 날짜 표시
      fixedWeekCount: false,
      eventOrder: ['-is_promotion', '-is_day', 'start_datetime', 'end_datetime'],
      slotEventOverlap: false,
      scrollTime:
        (this.computedInitialView() === 'timeGridDay' || this.computedInitialView() === 'timeGridWeek') &&
        moment().subtract(8, 'hover').format('HH:mm:ss'),
      firstDay: this.computedStartWeek(),
      headerToolbar: {
        left: '',
        center: 'prev,title,next,today',
        right: 'timeGridDay,timeGridWeek,dayGridMonth',
      },
      datesSet: function (dateInfo) {
        CAC_VIEW.datesSetHandler(dateInfo);
      },

      dateClick: function (info) {
        info.jsEvent.preventDefault();

        const currentDate = moment(info.date).format('YYYY-MM-DD');
        const dateDD = moment(info.date).format('D');
        const datedd = moment(info.date).format('dd');
        const eventTitle = `${dateDD}일 (${datedd})`;

        const layer = CAC$('#layerAllEvent', CAC.getRoot());
        const layerTitle = layer.find('h1');
        layerTitle.html(eventTitle);

        // layer .cont .events
        const layerCont = layer.find('.cont');
        layerCont.find('.events').remove();

        const calendarData = CAC_VIEW.eventList.filter((item) => {
          // check info.date in info.start and info.end
          // day
          const infoDate = moment(info.date).format('YYYY-MM-DD');
          const startDate = moment(item.start_datetime).format('YYYY-MM-DD');
          const endDate = moment(item.end_datetime).format('YYYY-MM-DD');

          return moment(infoDate).isBetween(startDate, endDate, null, '[]');
        });

        // 마켓 프로모션
        const promotionData = CAC_VIEW.promotion_data.filter((item) => {
          const infoDate = moment(info.date).format('YYYY-MM-DD');
          const startDate = moment(item.start_datetime).format('YYYY-MM-DD');
          const endDate = moment(item.end_datetime).format('YYYY-MM-DD');

          return moment(infoDate).isBetween(startDate, endDate, null, '[]');
        });

        // 시즌 이벤트
        const seasonEventData = CAC_VIEW.season_data.filter((item) => {
          const infoDate = moment(info.date).format('YYYY-MM-DD');
          const startDate = moment(item.start_datetime).format('YYYY-MM-DD');
          const endDate = moment(item.end_datetime).format('YYYY-MM-DD');

          return moment(infoDate).isBetween(startDate, endDate, null, '[]');
        });

        const checkedEventFilter = CAC.getRoot().querySelectorAll('input[name="event_filter"]:checked');
        const checkedEventFilterArray = Array.from(checkedEventFilter);
        const checkedEventFilterIds = checkedEventFilterArray.map((item) => item.value);

        const events = [...calendarData, ...promotionData, ...seasonEventData].filter((event) => {
          return checkedEventFilterIds.includes(event.calendar_group_id);
        });

        if (events.length === 0) {
          return;
        }

        const sortedEvents = [...events].sort(CAC_VIEW.sortCalendarList);

        const eventsHtml = sortedEvents
          .map((event) => {
            let eventStart = '';
            let eventEnd = '';
            if (event.is_day === 'T') {
              eventStart = moment(event.start_datetime).format('YYYY.MM.DD');
              eventEnd = moment(event.end_datetime).format('YYYY.MM.DD');
            } else {
              eventStart = moment(event.start_datetime).format('YYYY.MM.DD HH:mm');
              eventEnd = moment(event.end_datetime).format('YYYY.MM.DD HH:mm');
            }

            const titleEl = document.createElement('div');
            titleEl.classList.add('title');
            titleEl.innerText = event.title;

            return `<a href="javascript:void(0)" style="--eventColor: ${event.color};" onclick="
		CAC_VIEW.showDetail('${event.id}','${currentDate}')">
									${titleEl.outerHTML}
									<div class="date">${eventStart} ~ ${eventEnd}</div>
								</a>`;
          })
          .join('');

        layerCont.append(`<div class="events">${eventsHtml}</div>`);

        CAC_VIEW.appendDimed();
        // 레이어 팝업 열릴 때 body 스크롤 방지
        CAC$('body').css('overflow', 'hidden');
        layer.css('display', 'block');
      },

      eventClick: async (info) => {
        info.jsEvent.preventDefault();
        if (info.view.type !== 'dayGridMonth') {
          const eventId = info.event.id;
          const currentDate = moment(info.event.start).format('YYYY-MM-DD');
          await CAC_VIEW.showDetail(eventId, currentDate);
        }
      },

      //event filter
      eventClassNames: function (info) {
        let result = true;
        let groups = [];

        CAC$("input[name='event_filter']:checked", CAC.getRoot()).each(function () {
          if (CAC$(this).data('type') == 'group') {
            groups.push(CAC$(this).val());
          }
        });

        if (groups.length > 0) {
          result = result && groups.indexOf(info.event.extendedProps?.calendar_group_id) >= 0;
        } else {
          result = false;
        }

        // 체크되지 않은 일정 클래스 추가
        if (!result) {
          result = 'filter-hidden';
        }
        return result;
      },

      eventContent: (info) => {
        let dom = null;

        dom = document.createElement('div');
        dom.className = 'fc-event-title';
        dom.style.padding = '2px';
        dom.style.cursor = 'pointer';

        if (info.event.extendedProps.is_complete === 'T') {
          const del = document.createElement('del');
          del.innerText = `${info.event.title}`;
          dom.appendChild(del);
        } else {
          dom.innerText = `${info.event.title}`;
        }

        return {
          domNodes: [dom],
        };
      },

      //event data
      events: this.eventList,
    });

    calendar.render();

    // 필터 변경시 이벤트 핸들러 추가
    CAC$("input[name='event_filter']", CAC.getRoot()).change(function () {
      CAC_VIEW.applyEventFilter();
    });

    this.calendar = calendar;
  },

  // 검색결과 캘린더
  renderSearchCalendar: function () {
    let calendarEl = CAC.getRoot().getElementById('calendar');
    let calendar = new FullCalendar.Calendar(calendarEl, {
      // lang
      locale: 'ko',

      views: {
        listGridForAll: {
          type: 'list',
          visibleRange: (currentDate) => {
            return {
              start: moment(currentDate).subtract(10, 'year').format('YYYY-MM-DD'),
              end: moment(currentDate).add(10, 'year').format('YYYY-MM-DD'),
            };
          },
        },
      },
      // style
      initialView: 'listGridForAll',
      height: 'auto',
      slotMinTime: '00:00',
      slotMaxTime: '24:00',
      navLinks: false, // 요일, 날짜 클릭 시 일/주 단위 화면으로 넘어감
      expandRows: true,
      editable: false, // 드래그 수정 여부
      selectable: false, //
      nowIndicator: true, //
      dayMaxEvents: true, // "more" 표시 전 최대 이벤트 갯수. true - 셀 높이에 따라 결정
      eventDisplay: 'block',
      noEventsContent: '검색 결과가 없습니다.',

      headerToolbar: {
        left: '',
        center: '',
        right: '',
      },

      //event layer

      eventClick: async (info) => {
        info.jsEvent.preventDefault();

        const eventInfo = info.event;
        const props = eventInfo.extendedProps || {};
        const {
          description: eventDesc,
          external_link_url: eventUrl,
          link_products: eventImage,
          start_datetime,
          end_datetime,
          is_day
        } = props;

        const layer = CAC$('#layerCalendarEvent', CAC.getRoot());
        const layerTitle = layer.find('h1');
        const layerCont = layer.find('.cont');

        // 초기화
        layerTitle.html(eventInfo.title);
        layerCont.find('div').remove();

        // 날짜 추가
        this.buildDate(layerCont, start_datetime, end_datetime, is_day, eventInfo.end);

        // 이미지 추가
        await this.buildImages(layerCont, eventImage);
        // URL 추가
        this.buildUrl(layerCont, eventUrl);

        // 설명 추가
        this.buildDescription(layerCont, eventDesc);

        // 모바일/PC 처리
        if (CAC$('#calendar_wrap', CAC.getRoot()).hasClass('mobile')) {
          this.showDetail(eventInfo.id, this.conversion(eventInfo.start));
          CAC$('#calendar_wrap #mobile_search_calendar_head', CAC.getRoot()).hide();
        } else {
          layer.css('display', 'block');
        }
      },

      //event data
      events: this.eventList,
    });
    calendar.render();

    this.calendar = calendar;
  },

  DOMContentLoaded: function () {
    const inputBox = CAC$('.inputSearch .inputbox', CAC.getRoot());
    const btnClear = CAC$('.inputSearch .btn_clear', CAC.getRoot());
    const btnSearch2 = CAC$('.inputSearch .btn_search2', CAC.getRoot());
    const calendarFilter = CAC$('.calendar_filter', CAC.getRoot());
    const btnSelect = calendarFilter.find('.btn_select');

    // 초기 버튼 상태
    this.initClearButton(inputBox, btnClear);

    // 이벤트 바인딩
    this.bindInputEvents(inputBox, btnClear);
    this.bindClearButton(btnClear, inputBox);
    this.bindSearchButton(btnSearch2, inputBox);
    this.bindCalendarFilter(btnSelect, calendarFilter);

    // 검색 관련 초기화
    this.debounceSearch = CAC_UTIL.debounce(this.searchData, 500);
    this.searchInputByKeyup();
    this.searchEventClick();
    this.bindPcSearchButton();

    // 모바일 초기화
    this.mobileSearchEvent();
    if (CAC_UTIL.isMobile()) this.initPopStateListener();
  },

// 초기 clear 버튼 표시
  initClearButton: function (inputBox, btnClear) {
    if (inputBox.val() === '') {
      btnClear.hide();
    } else {
      btnClear.show();
    }
  },

  bindInputEvents: function (inputBox, btnClear) {
    inputBox.on('focus focusout input', () => {
      if (inputBox.val() === '') {
        btnClear.hide();
      } else {
        btnClear.show();
      }
    });
  },

  bindClearButton: function (btnClear, inputBox) {
    btnClear.on('click', function () {
      inputBox.val('').focus();
      CAC$('.calendar_search .inputSearch .calendar_search_layer', CAC.getRoot()).hide();
      if (CAC_UTIL.isMobile()) {
        CAC_VIEW.calendar.removeAllEvents();
      }
    });
  },

  bindSearchButton: function (btnSearch2, inputBox) {
    btnSearch2.on('click', () => {
      const searchVal = inputBox.val();
      if (!searchVal) return;
      CAC_VIEW.debounceSearch(searchVal);
      if (CAC_UTIL.isMobile()) CAC_VIEW.setSearchView(true);
    });
  },

  bindCalendarFilter: function (btnSelect, calendarFilter) {
    if (CAC_VIEW.group_id) {
      btnSelect.addClass('group').css('padding-right', '0');
    }

    btnSelect.on('click', () => {
      if (!CAC_VIEW.group_id) {
        calendarFilter.toggleClass('active');
      }
    });
  },

  bindPcSearchButton: function () {
    CAC$('.calendar_search .inputSearch #pcSearchBtn', CAC.getRoot()).on('click', (e) => {
      e.preventDefault();
      const searchVal = CAC$('.calendar_search .inputSearch .inputbox', CAC.getRoot()).val();
      CAC_VIEW.searchEvent(searchVal);
    });
  },

  /**
   * popstate 이벤트 리스너 초기화
   */
  initPopStateListener: function () {
    window.addEventListener('popstate', function (event) {
      // 상세 페이지에서 뒤로가기 버튼을 눌렀을 때
      if (CAC$('#calendar_header', CAC.getRoot()).css('display') === 'block') {
        // 이전 상태가 검색 상태인지 확인
        const fromSearch = event.state && event.state.fromSearch;

        if (fromSearch) {
          // 검색 화면으로 돌아가기 위한 상태 설정
          CAC$('#mobile_search_calendar_head', CAC.getRoot()).css('display', 'block');
          CAC$('#calSearchMobile', CAC.getRoot()).css('display', 'block');
          CAC$('.calendar_view', CAC.getRoot()).addClass('search');
          CAC$('.calendar_view .calendar_search', CAC.getRoot()).css('display', 'none');
          CAC$('.calendar_view .calendar_filter', CAC.getRoot()).css('display', 'none');

          // 검색어가 있으면 다시 설정
          if (event.state && event.state.searchKeyword) {
            CAC$('#calSearchMobile .inputbox', CAC.getRoot()).val(event.state.searchKeyword);
          }
        }

        CAC_VIEW.backToCalendar();
        return;
      }

      // 검색 페이지에서 뒤로가기 버튼을 눌렀을 때
      if (CAC$('#calSearchMobile', CAC.getRoot()).css('display') === 'block') {
        CAC_VIEW.closeMobileSearch();
        return;
      }

      // URL에서 해시 제거
      if (
        window.location.hash &&
        (window.location.hash.startsWith('#event-') || window.location.hash.startsWith('#search-'))
      ) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    });
  },

  searchInputByKeyup: function () {
    CAC$('.inputSearch .inputbox', CAC.getRoot()).on('keyup', function () {
      let searchVal = CAC$(this).val();
      if (!searchVal) return;
      CAC_VIEW.debounceSearch(searchVal);
    });
  },

  searchedEventList: null,
  searchData: async function (searchVal) {
    const searchValue = he.decode(searchVal);

    if (!searchValue.trim()) return;

    const products = await CAC_CAFE24API.getProductsByKeyword(searchValue);

    let productsNos = '';
    let productCalendarList = [];
    if (products) {
      productsNos = products.map((product) => product.product_no);
      productCalendarList = (await CAC_DATA.loadRemoteCalendarDataByProductsNo(productsNos))?.lists || [];
    }

    let calendar_list = (await CAC_DATA.loadRemoteCalendarData('', '', searchValue))?.lists || [];

    // 중복 제거: calendar_list와 productCalendarList 병합 후 _id 기준으로 중복 제거
    const mergedCalendarList = [...calendar_list, ...productCalendarList];
    const uniqueCalendarList = mergedCalendarList.filter(
      (event, index, self) => index === self.findIndex((e) => e._id === event._id),
    );

    // 마켓프로모션 데이터 요청
    const promotionGroup = CAC_VIEW.calendarGroupList.find(
      (group) => group.category === 'PROMOTION' && group.type === 'MARKET_PROMOTION',
    );

    let promotionData = [];
    if (promotionGroup?.display_front === 'T') {
      const promotionRemoteData =
        (await CAC_DATA.loadMarketPromotionData(
          moment().subtract(92, 'day').format('YYYY-MM-DD'),
          moment().format('YYYY-MM-DD'),
          searchValue,
        )) || [];
      promotionData = CAC_VIEW.parsePromotionEvent(promotionRemoteData);
    }

    // 시즌 이벤트 데이터 요청
    const seasonGroup = CAC_VIEW.calendarGroupList.find(
      (group) => group.category === 'SEASON' && group.type === 'SEASON_EVENT',
    );

    let seasonData = [];
    if (seasonGroup?.display_front === 'T') {
      const seasonRemoteData = (await CAC_DATA.loadSeasonEventData('', '', searchValue)) || [];
      seasonData = CAC_VIEW.parseSeasonEvent(seasonRemoteData);
    }

    const calendarData = this.parseEvent(uniqueCalendarList);
    this.searchedEventList = [...calendarData, ...promotionData, ...seasonData];

    if (!CAC_UTIL.isMobile()) {
      CAC_VIEW.searchEvent(searchValue);
    } else {
      this.calendarList = this.searchedEventList;

      // 모바일 검색 시 history 상태 저장
      if (!window.location.hash.startsWith('#search-')) {
        history.pushState({ type: 'search', keyword: searchValue }, '', `#search-${Date.now()}`);
      }

      this.renderSearchCalendar();
    }
  },
  // 이벤트 검색
  searchEvent: async function (value) {
    // 검색시 원격데이터 호출

    if (value.trim() === '') {
      CAC$('.calendar_search .inputSearch .calendar_search_layer', CAC.getRoot()).css('display', 'none');
      return;
    }

    if (value.trim().length > 0) {
      CAC$('.calendar_search .inputSearch .calendar_search_layer', CAC.getRoot()).css('display', 'block');

      let searchedData = '';
      CAC$('.calendar_search .inputSearch .calendar_search_layer ul', CAC.getRoot()).empty();

      const searchedEvent = this.searchedEventList;
      if (searchedEvent.length === 0) {
        searchedData = '<div style="padding: 5px 10px">검색 결과가 없습니다.</div>';
        CAC$('.calendar_search .inputSearch .calendar_search_layer ul', CAC.getRoot()).css('height', 'auto');
        CAC$('.calendar_search .inputSearch .calendar_search_layer ul', CAC.getRoot()).html(
          `<div style="display: flex;justify-content: center">${searchedData}</div>`,
        );
      } else {
        searchedData = '';
        CAC$('.calendar_search .inputSearch .calendar_search_layer ul', CAC.getRoot()).css('height', 'auto');
        searchedEvent.forEach((item) => {
          const liEl = document.createElement('li');
          const aEl = document.createElement('a');
          aEl.href = '#';
          aEl.dataset.id = item._id;
          aEl.innerText = item.title;
          liEl.appendChild(aEl);

          searchedData += liEl.outerHTML;
        });
        CAC$('.calendar_search .inputSearch .calendar_search_layer ul', CAC.getRoot()).append(searchedData);
      }
    }
  },
  /**
   * 검색된 이벤트 클릭시 상세 정보 팝업
   */
  searchEventClick: function () {
    // .calendar_search_layer>ul>li 클릭 이벤트
    CAC$('.calendar_search .inputSearch .calendar_search_layer ul', CAC.getRoot()).on('click', 'li', function () {
      const searchVal = CAC$(this).text();
      let eventId = CAC$(this).find('a').data('id');

      const event = CAC_VIEW.searchedEventList.find((item, index) => {
        if (item._id === eventId) {
          return true;
        }
        if (
          item.calendar_group_category === 'PROMOTION' &&
          item.calendar_group_type === 'MARKET_PROMOTION' &&
          item.board_no === eventId
        ) {
          return true;
        }
        if (
          item.calendar_group_category === 'SEASON' &&
          item.calendar_group_type === 'SEASON_EVENT' &&
          item.id === parseInt(eventId)
        ) {
          return true;
        }
      });

      // set search value
      CAC$('.calendar_search .inputSearch .inputbox', CAC.getRoot()).val(searchVal);
      CAC$('.calendar_search .inputSearch .calendar_search_layer', CAC.getRoot()).css('display', 'none');

      // goto date
      CAC_VIEW.calendar.gotoDate(moment(event.start_datetime).format('YYYY-MM-DD'));
      CAC_VIEW.customEventClick(event);
    });
  },

  generateProductImagesHTML : async (images) => {
    if (!images || images.length === 0) return '';

    let imagesHTML = '';
    for (const item of images) {
      const productHTML = await CAC_VIEW.renderProductDetailView(item);
      if (productHTML) {
        imagesHTML += productHTML;
      }
    }
    return `<div class="image"><ul>${imagesHTML}</ul></div>`;
  },

  generateUrlHTML: (url) => {
    if (!url) return '';

    const newUrl = url.includes('http://') || url.includes('https://') ? url : 'https://' + url;
    return `<div class="url"><a href="${newUrl}" target="_blank">${url}</a></div>`;
  },

  /**
   * 검색된 이벤트 클릭시 상세 정보 세팅
   * @param event
   */
  customEventClick: async (event) => {
    const eventInfo = event;
    const eventTitle = eventInfo.title;
    const eventDesc = eventInfo?.description;
    const eventBoard = eventInfo.link_board_article;
    const eventUrl = eventInfo?.external_link_url;
    const eventImage = eventInfo?.link_products;
    const eventCategories = eventInfo?.link_categories;
    const startDate = eventInfo.start_datetime;
    const endDate = eventInfo.end_datetime;
    const isDay = eventInfo.is_day

    // 레이어 초기화
    const initializeLayer = (title) => {
      const layer = CAC$('#layerCalendarEvent', CAC.getRoot());
      const layerTitle = layer.find('h1');
      const layerCont = layer.find('.cont');

      layer.css('display', 'block');
      layerTitle.text(title);
      layerCont.find('div').remove();

      return layerCont;
    };

    // 메인 로직 실행
    const layerCont = initializeLayer(eventTitle);

    // 순차적으로 콘텐츠 추가
    CAC_VIEW.buildDate(layerCont, startDate, endDate, isDay, eventInfo.end);
    await CAC_VIEW.buildImages(layerCont, eventImage);
    CAC_VIEW.buildBoard(layerCont, eventBoard);
    await CAC_VIEW.buildCategories(layerCont, eventCategories);
    CAC_VIEW.buildUrl(layerCont, eventUrl);
    CAC_VIEW.buildDescription(layerCont, eventDesc)
  },

  /**
   * 모바일 상세정보 팝업
   * @param eventId
   * @param currentDate
   */
  showDetail: async (eventId, currentDate) => {
    const event = [...CAC_VIEW.eventList, ...CAC_VIEW.promotion_data, ...CAC_VIEW.season_data].find(
        item => item._id === parseInt(eventId) || item._id === eventId
    );

    // history 상태
    const pushHistory = () => {
      if (!CAC_UTIL.isMobile()) return;
      const isFromSearch = CAC$('#calSearchMobile', CAC.getRoot()).css('display') === 'block';
      const searchKeyword = isFromSearch ? CAC$('#calSearchMobile .inputbox', CAC.getRoot()).val() : '';
      history.pushState({ type: 'detail', eventId, currentDate, fromSearch: isFromSearch, searchKeyword }, '', `#event-${eventId}`);
    };

    // DOM 초기화
    const hideElements = () => {
      ['.calendar_view', '#layerAllEvent', '#mobile_search_calendar_head', '.dimed'].forEach(sel =>
          CAC$(sel, CAC.getRoot()).css('display', 'none')
      );
    };

    const setupDetailLayer = () => {
      const detailEl = CAC$('#calendar_header', CAC.getRoot());
      CAC$('#calendar_header .calendar_head', CAC.getRoot()).css('display', 'block');
      detailEl.css('display', 'block');
      detailEl.find('.calendar_head .title').html(currentDate);
      return detailEl.find('.detail_view');
    };

    const renderGroups = (container) => {
      if (!event.is_promotion) {
        CAC_VIEW.renderThirdPartyCalGroups(
            container,
            event?.calendar_group_id || '',
            event._id || '',
            event.title,
            event.start_datetime || '',
            event.end_datetime || '',
            event.is_day || 'F'
        );
      } else {
        container.find('.calendar_groups').html('');
      }
    };

    const renderElement = async (el, html, display = true) => {
      if (!html) return el.css('display', 'none');
      el.html(html).css('display', display ? 'block' : 'none');
    };

    const renderDate = (el) => {
      let text;
      if (event.is_day === 'T') {
        text = !event.end_datetime
            ? moment(event.start_datetime).format('YYYY-MM-DD')
            : `${moment(event.start_datetime).format('YYYY-MM-DD')} ~ ${moment(event.end_datetime).format('YYYY-MM-DD')}`;
      } else {
        text = `${moment(event.start_datetime).format('YYYY-MM-DD HH:mm')} ~ ${moment(event.end_datetime).format('YYYY-MM-DD HH:mm')}`;
      }
      el.html(text).css('display', 'block');
    };

    const renderImages = async (el) => {
      if (!Array.isArray(event.link_products) || event.link_products.length === 0) return el.css('display', 'none');
      let html = '';
      for (const item of event.link_products) {
        const itemHTML = await CAC_VIEW.renderProductDetailView(item);
        if (itemHTML) html += itemHTML;
      }
      renderElement(el, `<ul>${html}</ul>`);
    };

    const renderCategories = async (el) => {
      if (!Array.isArray(event.link_categories) || event.link_categories.length === 0) return el.css('display', 'none');
      const html = await CAC_VIEW.generateCategoriesHTML(event.link_categories, h => `<ul>${h}</ul>`);
      renderElement(el, html);
    };

    const renderUrl = (el) => {
      if (!event.external_link_url) return el.css('display', 'none');
      const hrefUrl = /^(http|https):\/\//.test(event.external_link_url)
          ? event.external_link_url
          : 'https://' + event.external_link_url;
      const safeHref = CAC_VIEW.escapeHtml(hrefUrl);
      const safeText = CAC_VIEW.escapeHtml(event.external_link_url);
      renderElement(el, `<a href="${safeHref}" target="_blank">${safeText}</a>`);
    };

    const renderBoard = (el) => {
      const board = event.link_board_article;
      if (!board || typeof board !== 'object' || Object.keys(board).length === 0) return el.css('display', 'none');
      const html = `<a href="${CAC_VIEW.getBoardLink(board.board_name, board.board_no, board.article_no)}" target="_blank">${board.title}</a>`;
      renderElement(el, html);
    };

    const renderDescription = (el) => renderElement(el, event.description);

    // 실행 순서
    pushHistory();
    hideElements();
    const detailViewEl = setupDetailLayer();
    renderGroups(detailViewEl);

    const els = {
      title: detailViewEl.find('.title h1'),
      date: detailViewEl.find('.cont .date'),
      description: detailViewEl.find('.cont .description'),
      url: detailViewEl.find('.cont .url'),
      board: detailViewEl.find('.cont .board'),
      image: detailViewEl.find('.cont .image'),
      categories: detailViewEl.find('.cont .categories'),
    };

    els.title.text(event.title);
    renderDate(els.date);
    await renderImages(els.image);
    await renderCategories(els.categories);
    renderUrl(els.url);
    renderBoard(els.board);
    renderDescription(els.description);

    CAC$('body').css('overflow', '');
  },

  /**
   * 상세정보 팝업 닫기
   */
  backToCalendar: function () {
    const showSearchCalendar = (keyword) => {
      const root = CAC.getRoot();
      CAC$('#mobile_search_calendar_head', root).show();
      CAC$('#calSearchMobile', root).show();
      CAC$('.calendar_view', root).addClass('search');
      CAC$('.calendar_view .calendar_search', root).hide();
      CAC$('.calendar_view .calendar_filter', root).hide();

      if (keyword) {
        CAC$('#calSearchMobile .inputbox', root).val(keyword);
        if (this.searchedEventList?.length > 0) {
          this.calendarList = this.searchedEventList;
          this.renderSearchCalendar();
        } else {
          this.debounceSearch(keyword);
        }
      } else {
        this.renderSearchCalendar();
      }
    };

    const showNormalCalendar = () => {
      const root = CAC.getRoot();
      CAC$('.calendar_head', root).hide();
      CAC$('.calendar_view', root).removeClass('search');
      CAC$('.calendar_view .calendar_search', root).show();
      CAC$('.calendar_view .calendar_filter', root).show();
      this.renderCalendarMobile();
    };

    const handleMobileState = () => {
      const state = history.state;
      if (!state) return showNormalCalendar();

      switch (state.type) {
        case 'detail':
          if (state.fromSearch && CAC_UTIL.isMobile()) showSearchCalendar(state.searchKeyword);
          break;
        case 'search':
          if (CAC_UTIL.isMobile()) showSearchCalendar(state.keyword);
          break;
        default:
          if (CAC_UTIL.isMobile()) showNormalCalendar();
      }
    };

    CAC_VIEW.removeDimed();
    CAC$('#calendar_header', CAC.getRoot()).hide();
    CAC$('.calendar_view', CAC.getRoot()).show();

    handleMobileState();
  },

  /**
   * 모바일 검색 뷰 설정
   * @param isSearchView
   */
  setSearchView: function (isSearchView = true) {
    if (CAC_UTIL.isMobile()) {
      const shadowRoot = CAC.getRoot();

      // 검색했을시
      if (isSearchView) {
        // history API를 사용하여 상태 저장
        if (!window.location.hash.startsWith('#search-')) {
          history.pushState(
            { type: 'search', keyword: CAC$('#calSearchMobile .inputbox', shadowRoot).val() },
            '',
            `#search-${Date.now()}`,
          );
        }

        CAC$('#calendar_wrap #mobile_search_calendar_head', shadowRoot).css('display', 'block');
        CAC$('#calSearchMobile', shadowRoot).css('display', 'block');

        //calendar_view add class search
        CAC$('.calendar_view', shadowRoot).addClass('search');

        // calendar_search
        CAC$('.calendar_view .calendar_search', shadowRoot).css('display', 'none');
        CAC$('.calendar_view .calendar_filter', shadowRoot).css('display', 'none');

        this.renderSearchCalendar();

        // 검색시 초기값 설정
        CAC_VIEW.calendar.getEvents().forEach((event) => {
          event.setProp('display', 'none');
        });
      } else {
        //calendar_view remove class search
        CAC$('.calendar_view', shadowRoot).removeClass('search');

        // calendar_search
        CAC$('.calendar_view .calendar_search', shadowRoot).css('display', 'block');
        CAC$('.calendar_view .calendar_filter', shadowRoot).css('display', 'block');

        CAC$('#calendar_wrap #mobile_search_calendar_head', shadowRoot).css('display', 'none');
        CAC$('#calSearchMobile', shadowRoot).css('display', 'none');

        this.renderCalendarMobile();
      }
    }
  },
  /**
   * 모바일 캘린더 검색
   */
  mobileSearchEvent: function () {
    CAC$('#calSearchMobile .inputbox', CAC.getRoot()).on('keyup', function () {
      let searchVal = CAC$(this).val();

      // filter event
      if (searchVal === '') {
        return;
      }

      // search event
      CAC_VIEW.debounceSearch(searchVal);
    });
  },

  closeMobileSearch: async function () {
    // 취소시 이벤트 초기화
    CAC$('#calSearchMobile .inputbox', CAC.getRoot()).val('');

    // 브라우저 뒤로가기 버튼을 통해 호출된 것이 아니라면 history에서 이전 상태로 돌아감
    if (history.state && history.state.type === 'search') {
      history.back();
      return;
    }

    CAC_VIEW.setSearchView(false);
  },

  // 팝업 공통
  openLayer: function (IdName) {
    CAC_VIEW.removeDimed();
    CAC$('.layer_popup', CAC.getRoot()).css('display', 'none');
    if (CAC$('#calendar_wrap', CAC.getRoot()).hasClass('mobile')) {
      CAC_VIEW.appendDimed();
    }
    CAC$('#' + IdName, CAC.getRoot()).css('display', 'block');
  },
  closeLayer: function (IdName) {
    CAC_VIEW.removeDimed();
    CAC$('#' + IdName, CAC.getRoot()).css('display', 'none');
  },
  appendDimed: function (target) {
    CAC$('#calendar_wrap', CAC.getRoot()).append('<div class="dimed"></div>');
    CAC$('.dimed', CAC.getRoot()).css('display', 'block');
    CAC$('.dimed', CAC.getRoot()).on('click', function () {
      CAC$('.layer_popup', CAC.getRoot()).css('display', 'none');
      CAC_VIEW.removeDimed();
      // dimed 제거 시 body 스크롤 복원
      CAC$('body').css('overflow', '');
    });
  },
  removeDimed: function () {
    CAC$('.dimed', CAC.getRoot()).remove();
    // dimed 제거 시 body 스크롤 복원
    CAC$('body').css('overflow', '');
  },
  handleCheckCalendarGroupDisplay: function () {
    if (CAC_VIEW.calendarGroupList.length === 0) {
      return;
    }
    CAC_VIEW.openLayer('layerCalendarList');
    CAC$('body').css('overflow', 'hidden');
  },

  renderProductDetailView: async function (product) {
    const cafe24Product = await CAC_CAFE24API.getProducts(product.product_no);
    if (!cafe24Product) return;

    const itemNames = product.items.map((item) => item.item_name).join(', ');
    const itemName = itemNames.length > 0 ? `(${itemNames})` : '';

    const soldOutHtml = cafe24Product?.sold_out === 'T' ? '<span class="soldout">SOLD OUT</span>' : '';
    return `<li class="first">
      <a href="${CAC_VIEW.getShopPath()}/product/detail.html?product_no=${product.product_no}" title="${cafe24Product?.product_name ?? product.product_name} ${itemName}" target="_blank">
        <img src="${cafe24Product?.image ?? product.image}" alt="${cafe24Product?.product_name ?? product.product_name} ${itemName}">
        ${soldOutHtml}
      </a>
    </li>`;
  },
  generateCategoriesHTML: async function (eventCategories, wrapperFn = null) {
    if (!eventCategories || eventCategories.length === 0) return '';
    const categoriesHTML = await Promise.all(
      eventCategories.map(async (item) => {
        const category = await CAC_CAFE24API.getCategories(item.category_no);
        if (!category) return '';

        const cleanCategoryName = encodeURIComponent(category.category_name);

        return `
      <li class="first">
        <a href="${CAC_VIEW.getShopPath()}/category/${cleanCategoryName}/${category.category_no}/" target="_blank">
          <span class="name">${category.category_name}</span>
        </a>
      </li>
    `;
      }),
    ).then((results) => results.join(''));

    // 기본 래퍼 함수
    const defaultWrapper = (html) => `<div class="categories"><ul>${html}</ul></div>`;

    // wrapperFn이 제공되면 사용하고, 아니면 기본 래퍼 사용
    return categoriesHTML ? (wrapperFn || defaultWrapper)(categoriesHTML) : '';
  },
  getBoardLink: function (board_name, board_no, article_no) {
    return `${CAC_VIEW.getShopPath()}/article/0/${board_no}/${article_no}/`;
  },

  THIRD_PARTY_CALENDARS: [
    {
      name: 'google',
      title: '구글 캘린더로 일정 가져가기',
      url: 'https://calendar.google.com/calendar/u/0/r/eventedit?details={description}&text={title}&dates={start_datetime}/{end_datetime}',
    },
  ],
  renderThirdPartyCalGroups: function (
    layer,
    calendarGroupId,
    calendarId,
    title,
    start_datetime,
    end_datetime,
    allDay,
  ) {
    const isUseThirdPartyCal = this.checkUseThirdPartyCal();
    if (!isUseThirdPartyCal) {
      return;
    }

    const layerGroups = layer.find('.calendar_groups');
    const style = CAC_UTIL.isMobile() ? 'width: 24px; height: 24px;' : 'width: 30px; height: 30px;';
    layerGroups.empty();
    this.THIRD_PARTY_CALENDARS.forEach((target) => {
      layerGroups.append(`<a href="javascript:void(0)" onclick="CAC_VIEW.handleThirdPartyCalClick('${target.name}', '${calendarGroupId}', '${calendarId}', '${he.escape(he.encode(title))}', '${start_datetime}', '${end_datetime}', '${allDay}')">
        <img src="https://m-img.cafe24.com/images/ec/calendar/ico_calendar_${target.name}.png" style="${style}" /></a>`);
    });
  },

  // 고객 캘린더 연동 여부 확인
  checkUseThirdPartyCal: function () {
    if (this.group_id) {
      const group = this.calendarGroupList.find((group) => group._id === this.group_id);
      return group && group.single_calendar_use_third_party_cal === 'T';
    } else {
      return this.basic_setting?.use_third_party_cal === 'T';
    }
  },

  handleThirdPartyCalClick: function (
    targetName,
    calendarGroupId,
    calendarId,
    title,
    start_datetime,
    end_datetime,
    allDay,
  ) {
    const target = this.THIRD_PARTY_CALENDARS.find((target) => target.name === targetName);

    let startDate = ''
    let endDate = ''
    if (allDay === 'F') {
      startDate = encodeURIComponent(moment(start_datetime).format('YYYYMMDDTHHmmssZ'))
      endDate = encodeURIComponent(moment(end_datetime).format('YYYYMMDDTHHmmssZ'))
    } else {
      startDate = encodeURIComponent(moment(start_datetime).format('YYYYMMDD'))
      endDate = encodeURIComponent(moment(end_datetime).add(1, 'day').format('YYYYMMDD'))
    }
    const url = target.url
      .replace('{title}', he.unescape(encodeURIComponent(title)))
      .replace(
        '{start_datetime}',
        start_datetime
          ? startDate
          : '',
      )
      .replace(
        '{end_datetime}',
        end_datetime
          ? endDate
          : '',
      )
      .replace('{description}', '');
    CAC_DATA.updateThirdPartyCalClickCount(calendarGroupId, calendarId, targetName);
    window.open(url, '_blank');
  },
  layerPopupCloseAll: function () {
    CAC_VIEW.closeLayer('layerCalendarEvent');
    CAC$('.calendar_search_layer', CAC.getRoot()).css('display', 'none');
    CAC$('.calendar_filter ', CAC.getRoot()).removeClass('active');
  },
  getShopPath: function () {
    return CAFE24API.SHOP_NO == 1 ? '' : `/shop${CAFE24API.SHOP_NO}`;
  },
  applyEventFilter: function () {
    /**
     * 체크된 그룹에 해당하는 이벤트만 필터링하여 캘린더에 표시
     */

    // 현재 체크된 그룹 ID들을 가져옴
    const checkedGroups = [];
    CAC.getRoot()
      .querySelectorAll('input[name="event_filter"]:checked')
      .forEach(function (checkbox) {
        if (checkbox.getAttribute('data-type') === 'group') {
          checkedGroups.push(checkbox.value);
        }
      });

    // 모든 이벤트 제거
    this.calendar.removeAllEvents();

    // 체크된 그룹에 해당하는 이벤트만 필터링
    const filteredEvents = [...this.eventList, ...this.promotion_data, ...this.season_data].filter((event) =>
      checkedGroups.includes(event.calendar_group_id),
    );

    // 필터링된 이벤트 추가
    this.calendar.addEventSource(filteredEvents);

    // 캘린더 다시 렌더링
    this.calendar.render();
  },
};

const CAC = {
  currentElement: null,
  getRoot: function () {
    return this.currentElement.shadowRoot;
  },
};

const CAC_UTIL = {
  is_mobile: false,
  isMobile: function () {
    return this.is_mobile;
  },

  loadCSS: async function (url) {
    // https로 시작하는 경우 그대로 사용
    if (!url.startsWith('https://')) {
      // 현재 location.href가 /shop${shop_no}/로 시작하면, 현재 url 변수 앞에 /shop${shop_no}를 붙여준다.
      const path = location.href.replace(location.origin, '');
      if (CAFE24API.SHOP_NO != 1) {
        if (path.includes(`shop${CAFE24API.SHOP_NO}`)) {
          url = `/shop${CAFE24API.SHOP_NO}${url}`;
        }
      }
    }

    url += (url.includes('?') ? '&t=' : '?t=') + new Date();

    const response = await fetch(url);
    const cssText = await response.text();
    const style = document.createElement('style');
    style.textContent = cssText;
    return style;
  },
  debounce: function (func, wait, immediate = false) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      const later = function () {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  },
  isEcEditor: function () {
    return new URLSearchParams(window.location.search).get('PREVIEW_SDE') === '1';
  },
  observeTopAppBody: () => {
    const appBodyEl = window.top.document?.querySelector('.app-body') ?? null;
    if (!appBodyEl || appBodyEl.getAttribute('data-device') === 'undefined') return;

    const observer = new MutationObserver(async (mutationsList) => {
      for (let mutation of mutationsList) {
        if (mutation.type !== 'attributes') continue;
        CAC_UTIL.is_mobile = appBodyEl.getAttribute('data-device') === 'mo';
        this.shadowRoot.innerHTML = '';
        await this.render();
      }
    });
    observer.observe(appBodyEl, { attributes: true });
  },
  setMomentLocale: () => {
    moment.locale('ko', {
      months: '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
      monthsShort: '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
      weekdays: '일요일_월요일_화요일_수요일_목요일_금요일_토요일'.split('_'),
      weekdaysShort: '일_월_화_수_목_금_토'.split('_'),
      weekdaysMin: '일_월_화_수_목_금_토'.split('_'),
      longDateFormat: {
        LT: 'A h:mm',
        LTS: 'A h:mm:ss',
        L: 'YYYY.MM.DD.',
        LL: 'YYYY년 MMMM D일',
        LLL: 'YYYY년 MMMM D일 A h:mm',
        LLLL: 'YYYY년 MMMM D일 dddd A h:mm',
        l: 'YYYY.MM.DD.',
        ll: 'YYYY년 MMMM D일',
        lll: 'YYYY년 MMMM D일 A h:mm',
        llll: 'YYYY년 MMMM D일 dddd A h:mm',
      },
      calendar: {
        sameDay: '오늘 LT',
        nextDay: '내일 LT',
        nextWeek: 'dddd LT',
        lastDay: '어제 LT',
        lastWeek: '지난주 dddd LT',
        sameElse: 'L',
      },
      relativeTime: {
        future: '%s 후',
        past: '%s 전',
        s: '몇 초',
        ss: '%d초',
        m: '1분',
        mm: '%d분',
        h: '한 시간',
        hh: '%d시간',
        d: '하루',
        dd: '%d일',
        M: '한 달',
        MM: '%d달',
        y: '일 년',
        yy: '%d년',
      },
      dayOfMonthOrdinalParse: /\d{1,2}[일월주]/,
      ordinal: function (number, period) {
        switch (period) {
          case 'd':
          case 'D':
          case 'DDD':
            return number + '일';
          case 'M':
            return number + '월';
          case 'w':
          case 'W':
            return number + '주';
          default:
            return number;
        }
      },
      meridiemParse: /오전|오후/,
      isPM: function (token) {
        return token === '오후';
      },
      meridiem: function (hour, minute, isUpper) {
        return hour < 12 ? '오전' : '오후';
      },
    });
  }
};

const CAC_CAFE24API = {
  SDK: null,
  CONFIG: null,

  init: async function () {
    this.CONFIG = await this.getConfiguration();
    CAC_CAFE24API.SDK =
      !CAC_UTIL.isEcEditor() &&
      CAFE24API.init({
        client_id: this.CONFIG?.client_id,
        version: this.CONFIG?.app_version,
      });
  },

  getSiteName: function () {
    return document.head.querySelector('meta[property="og:site_name"]')?.content;
  },

  getSetting: async function () {
    const shopPath = CAFE24API.SHOP_NO == 1 ? '' : '/shop' + CAFE24API.SHOP_NO;
    const url = shopPath + '/calendar/app/setting.json?t=' + new Date().getTime();

    const res = await fetch(url);
    return await res.json();
  },

  getConfiguration: async function () {
    const res = await fetch(`/calendar/app/config.json`);
    return await res.json();
  },

  getProducts: async function (productNo) {
    return await new Promise((resolve, reject) => {
      CAC_CAFE24API.SDK.get('/api/v2/products/' + productNo + '?shop_no=' + CAFE24API.SHOP_NO, function (err, res) {
        if (err) {
          resolve(null);
        } else {
          resolve(res?.product);
        }
      });
    });
  },

  getProductsByKeyword: async function (keyword) {
    return await new Promise((resolve, reject) => {
      CAC_CAFE24API.SDK.get(
        '/api/v2/products?product_name=' + keyword + '&shop_no=' + CAFE24API.SHOP_NO,
        function (err, res) {
          if (err) {
            resolve(null);
          } else {
            resolve(res?.products);
          }
        },
      );
    });
  },

  getCategories: async function (categoryNo) {
    return await new Promise((resolve, reject) => {
      CAC_CAFE24API.SDK.get('/api/v2/categories/' + categoryNo + '?shop_no=' + CAFE24API.SHOP_NO, function (err, res) {
        if (err) {
          resolve(null);
        } else {
          resolve(res?.category);
        }
      });
    });
  },

  setEncryptedToken: async function () {
    const { member_id } = await CAPP_ASYNC_METHODS.AppCommon.getEncryptedMemberId(this.CONFIG?.client_id);
    if (member_id) {
      const memberTokenRes = await CAC_DATA.getMemberToken(member_id);
      if (memberTokenRes.code === 200) {
        CAC_VIEW.token = memberTokenRes.data?.token;
        CAC_VIEW.member_id = memberTokenRes.data?.member_id;
        CAC_VIEW.group_no = memberTokenRes.data?.group_no;

        CAC_LIST_VIEW.token = memberTokenRes.data?.token;
        CAC_LIST_VIEW.member_id = memberTokenRes.data?.member_id;
        CAC_LIST_VIEW.group_no = memberTokenRes.data?.group_no;
      }
    }
  },
};

const CAC_DATA = {
  getDataUrl: function () {
    return CAFE24.FRONT_JS_CONFIG_MANAGE.cdnUrl ?? location.origin;
  },

  // 회원토큰
  getMemberToken: async function (token) {
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/api/open/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
      }),
    }).then((res) => res.json());
  },

  loadConfigData: async function () {
    const data = {
      mall_id: CAFE24API.MALL_ID,
      shop_no: CAFE24API.SHOP_NO,
      token: CAC_VIEW.token
    };
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/api/open/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((res) => res.data)
      .catch((e) => {
        console.error('loadConfigData ERROR: ' + e);
      });
  },

  loadHolidayData: async function () {
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/openapi/holiday`)
      .then((res) => res.json())
      .catch((e) => console.error('loadHolidayData ERROR'));
  },

  loadSeasonEventData: async function (beginDate, endDate, searchKeyword) {
    const data = {
      begin_date: beginDate,
      end_date: endDate,
      title: searchKeyword,
      mall_id: CAFE24API.MALL_ID,
      shop_no: CAFE24API.SHOP_NO,
    };
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/api/open/season-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((res) => res.data)
      .catch((e) => console.error('loadSeasonEventData ERROR'));
  },

  loadMarketPromotionData: async function (beginDate, endDate, searchKeyword = '') {
    const data = {
      begin_date: beginDate,
      end_date: endDate,
      title: searchKeyword,
      mall_id: CAFE24API.MALL_ID,
      shop_no: CAFE24API.SHOP_NO,
    };
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/api/open/mp/promotion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((res) => res.data)
      .catch((e) => console.error('loadMarketPromotionData ERROR'));
  },

  loadRemoteCalendarData: async function (beginDate, endDate, searchKeyword = '') {
    const data = {
      mall_id: CAFE24API.MALL_ID,
      shop_no: CAFE24API.SHOP_NO,
      standard_start_datetime: beginDate,
      standard_end_datetime: endDate,
      token: CAC_VIEW.token || '',
      calendar_group_id: CAC_VIEW.group_id || '',
      search_keyword: searchKeyword,
    };
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/api/open/calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((res) => res.data)
      .catch((e) => console.error('loadRemoteCalendarData ERROR'));
  },

  loadRemoteCalendarDataByProductsNo: async function (productNos) {
    const data = {
      products_no: productNos,
      mall_id: CAFE24API.MALL_ID,
      shop_no: CAFE24API.SHOP_NO,
      token: CAC_VIEW.token || '',
      calendar_group_id: CAC_VIEW.group_id || '',
    };
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/api/open/calendar/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((res) => res.data)
      .catch((e) => console.error('loadRemoteCalendarDataByProductsNo ERROR'));
  },

  updateThirdPartyCalClickCount: async function (calendarGroupId, calendarId, type) {
    const data = {
      mall_id: CAFE24API.MALL_ID,
      shop_no: CAFE24API.SHOP_NO,
      calendar_group_id: calendarGroupId,
      calendar_id: calendarId,
      type,
    };
    return await fetch(`${CAC_CAFE24API.CONFIG.app_front}/api/open/update-third-party-cal-click-count`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => console.error('updateThirdPartyCalClickCount ERROR'));
  },
};

const CAC_LIST_VIEW = {
  groupId: null,
  basic_setting: {},
  calendar_group: [],
  currentSetting: {},
  beginDate: null,
  endDate: null,
  currentViewType: null,
  token: null,
  member_id: null,
  group_no: null,
  viewTypeForClassMap: {
    date_view: {
      cld_list: '',
    },
    img_view: {
      cld_list: 'type_img',
    },
    prd_view: {
      cld_list: 'type_prd',
    },
  },
  setBeginEndDate: function () {
    const now = moment();
    if (this.getStartCalendar() === 'W') {
      this.beginDate = now.startOf('day').format('YYYY-MM-DD 00:00');
      this.endDate = now.startOf('day').add(6, 'days').format('YYYY-MM-DD 23:59');
    } else if (this.getStartCalendar() === 'M') {
      // 월 단위 캘린더
      this.beginDate = now.startOf('month').format('YYYY-MM-DD 00:00');
      this.endDate = now.endOf('month').format('YYYY-MM-DD 23:59');
    }
  },
  DOMContentLoaded: async function (currentViewType) {
    this.currentViewType = currentViewType;
    this.setBeginEndDate();

    await this.render(currentViewType);
  },
  getEventData: async function (beginDate, endDate) {
    const calendar_list = await CAC_DATA.loadRemoteCalendarData(beginDate, endDate);
    const filterCalendarList = this.groupId
      ? calendar_list?.lists
      : calendar_list?.lists.filter((item) => item.display_front !== 'F');

    return filterCalendarList;
  },
  getStartCalendar: function () {
    const isMobile = CAC_UTIL.isMobile();
    return isMobile
      ? this.currentSetting?.single_calendar_front_start_calendar_mobile ||
          this.currentSetting?.front_start_calendar_mobile
      : this.currentSetting?.single_calendar_front_start_calendar || this.currentSetting?.front_start_calendar;
  },
  render: async function (currentViewType, currentDate) {
    const list_wrap = CAC$('.list_wrap', CAC.getRoot());
    const cmt_date = CAC$('.cmt_date', CAC.getRoot());

    const eventData = await this.getEventData(this.beginDate, this.endDate);
    await cmt_date.html(this.generateCmtDateHtml(currentDate));

    const html = await this.renderViewHtml(currentViewType, eventData);
    list_wrap.html(html);

    this.bindDropBtnEvents();
    this.bindTitBtnEvents();

    if (currentViewType === 'prd_view' && !CAC_UTIL.isMobile()) {
      await this.initSwiper();
    }
  },

// 뷰 타입에 따라 HTML 생성
  renderViewHtml: async function (viewType, eventData) {
    let html = `<ul class="cld_list ${this.viewTypeForClassMap[viewType]?.cld_list}">`;
    const generators = {
      'date_view': this.generateDateViewHtml,
      'img_view': this.generateImgViewHtml,
      'prd_view': this.generatePrdViewHtml,
    };
    if (generators[viewType]) {
      html += await generators[viewType].call(this, eventData);
    }
    html += '</ul>';
    return html;
  },

  bindDropBtnEvents: function () {
    const container = CAC.getRoot().querySelector('#calendar_wrap');
    const dropBtns = CAC.getRoot().querySelectorAll('.drop_btn');

    dropBtns.forEach((drop) => {
      drop.addEventListener('click', function () {
        const isOn = this.classList.contains('open');
        const contZone = drop.closest('li').querySelector('.content_zone');
        const btnText = drop.querySelector('.ico_drop');
        const btnDropTxt = drop.querySelector('.drop_txt');

        contZone?.classList.toggle('open');
        if (contZone?.innerText.trim() === '') contZone.style.padding = '0';
        this.classList.toggle('open');

        if (container?.classList?.contains('type_m')) {
          if (btnDropTxt) btnDropTxt.textContent = isOn ? '상세내역 보기' : '상세내역 닫기';
        } else if (btnText) {
          btnText.textContent = isOn ? '내용 열기' : '내용 닫기';
        }
      });
    });
  },

  bindTitBtnEvents: function () {
    const container = CAC.getRoot().querySelector('#calendar_wrap');
    const titBtns = CAC.getRoot().querySelectorAll('.tit_btn');

    titBtns.forEach((titBtn) => {
      titBtn.addEventListener('click', function () {
        const li = titBtn.closest('li');
        const contZone = li.querySelector('.content_zone');
        const btnText = li.querySelector('.ico_drop');
        const btnDropTxt = li.querySelector('.drop_txt');
        const btnDrop = li.querySelector('.drop_btn');
        const isOn = btnDrop.classList.contains('open');

        contZone?.classList.toggle('open');
        btnDrop?.classList.toggle('open');

        if (container.classList.contains('type_m')) {
          btnDropTxt.textContent = isOn ? '상세내역 보기' : '상세내역 닫기';
        } else {
          btnText.textContent = isOn ? '내용 열기' : '내용 닫기';
        }
      });
    });
  },

  initSwiper: async function () {
    await new Promise(resolve => setTimeout(resolve, 500));
    const swiperContainers = CAC.getRoot().querySelectorAll('.prd_list_wrap.swiper-container');

    swiperContainers.forEach((container) => {
      if (!container) return;
      const swiper = new Swiper(container, {
        slidesPerView: 'auto',
        freeMode: true,
        slideToClickedSlide: true,
        scrollbar: { draggable: true, dragSize: 100 },
      });
      console.info(swiper)
    });
  },

  generateCmtDateHtml: function (currentDate = null) {
    this.currentDate = currentDate || this.currentDate || moment();
    const isMobile = CAC_UTIL.isMobile();
    const startCalendar = this.getStartCalendar();

    return startCalendar === 'W'
        ? this.buildWeekHtml(isMobile)
        : this.buildMonthHtml(isMobile);
  },

  buildWeekHtml: function (isMobile) {
    let html = `
    <div class="inner_date">
      <div>
        <div style="display:flex;justify-content: space-around;padding: 0 30px;">`;

    for (let i = 0; i <= 6; i++) {
      const day = moment(this.currentDate).add(i, 'days');
      const isToday = day.isSame(moment(), 'day');
      const dateFormat = isMobile ? 'DD' : 'MM/DD';

      html += `
      <div class="date_wrap" style="width:100%;">
        <button type="button" class="btn_date${isToday ? ' on' : ''}">
          <span class="date_txt">${day.format(dateFormat)}</span>
          <span class="day_txt">${isToday ? '오늘' : day.format('ddd')}</span>
        </button>
      </div>`;
    }

    html += `
        </div>
      </div>
      <button type="button" class="btn_cmt btn_prev" onclick="CAC_LIST_VIEW.handleDateNavigation('prev')">
        <span class="ico_comm">이전</span>
      </button>
      <button type="button" class="btn_cmt btn_next" onclick="CAC_LIST_VIEW.handleDateNavigation('next')">
        <span class="ico_comm">다음</span>
      </button>
    </div>`;

    return html;
  },

  buildMonthHtml: function (isMobile) {
    return `
    <div class="inner_month" style="${!isMobile ? 'padding: 28px 0 15px;' : ''}">
      <button type="button" class="btn_cmt btn_prev" onclick="CAC_LIST_VIEW.handleDateNavigation('prev')">
        <span class="ico_comm">이전</span>
      </button>
      <strong class="date_month">${this.currentDate.format('YYYY.MM')}</strong>
      <button type="button" class="btn_cmt btn_next" onclick="CAC_LIST_VIEW.handleDateNavigation('next')">
        <span class="ico_comm">다음</span>
      </button>
    </div>`;
  },

  handleDateNavigation: async function (direction) {
    const startCalendar = this.getStartCalendar();

    let newDate;
    if (startCalendar === 'W') {
      // 주 단위 이동
      newDate = moment(this.currentDate)[direction === 'prev' ? 'subtract' : 'add'](7, 'days');
      this.beginDate = moment(newDate).format('YYYY-MM-DD 00:00');
      this.endDate = moment(newDate).add(6, 'days').format('YYYY-MM-DD 23:59');
    } else {
      // 월 단위 이동
      newDate = moment(this.currentDate)[direction === 'prev' ? 'subtract' : 'add'](1, 'month');
      this.beginDate = moment(newDate).startOf('month').format('YYYY-MM-DD 00:00');
      this.endDate = moment(newDate).endOf('month').format('YYYY-MM-DD 23:59');
    }
    // 새로운 날짜 범위로 이벤트 데이터를 가져와서 목록 업데이트
    await CAC_LIST_VIEW.render(CAC_LIST_VIEW.currentViewType, newDate);
  },

  statusBadge: function (startDate, endDate, isDay, isComplete) {
    const start = isDay ? moment(startDate).startOf('day') : moment(startDate);
    const end = isDay ? moment(endDate).endOf('day') : moment(endDate);
    const now = isDay ? moment().startOf('day') : moment();

    if (isComplete) {
      return '<span class="stt_badge type_prev">일정종료</span>';
    }

    if (start.isSameOrBefore(now) && end.isSameOrAfter(now)) {
      return '<span class="stt_badge type_ing">진행중</span>';
    }

    // 지난 일정
    if (end.isBefore(now)) {
      return '<span class="stt_badge type_prev">지난일정</span>';
    }

    if (start.isAfter(now)) {
      return '<span class="stt_badge">진행예정</span>';
    }
  },
  // 쇼셜 링크 생성
  socialBadge: function (external_link_type) {
    const isMobile = CAC_UTIL.isMobile();

    const badges = {
      youtube: ['ico_youtube', '유튜브'],
      instagram: ['ico_instagram', '인스타그램'],
      facebook: ['ico_facebook', '페이스북'],
      naver_shopping_live: ['ico_naver', '네이버쇼핑라이브'],
      kakao_shopping_live: ['ico_kakao', '카카오쇼핑라이브'],
      other: ['ico_link', '관련 링크'],
    };

    if (!badges[external_link_type]) return '';

    const [iconClass, label] = badges[external_link_type];
    return isMobile ? `<span class="ico_comm ${iconClass}"></span>` : `<span class="ico_comm ${iconClass}"></span>${label}`;
  },
  sortEvents: function (eventData) {
    return eventData.sort((a, b) => {
      // 먼저 시작 일자로 비교 (날짜만)
      const aStartDate = moment(a.start_datetime).startOf('day');
      const bStartDate = moment(b.start_datetime).startOf('day');

      const dateDiff = aStartDate.diff(bStartDate);
      if (dateDiff !== 0) return dateDiff;

      // 동일 날짜인 경우 일자만 설정됐는지 시간까지 설정됐는지 확인
      const aIsOnlyDay = a.is_day === 'T';
      const bIsOnlyDay = b.is_day === 'T';

      // 일자만 설정된 이벤트가 먼저 표시
      if (aIsOnlyDay && !bIsOnlyDay) return -1;
      if (!aIsOnlyDay && bIsOnlyDay) return 1;

      // 둘 다 시간 설정된 경우 시간순 정렬
      if (!aIsOnlyDay && !bIsOnlyDay) {
        return moment(a.start_datetime).diff(moment(b.start_datetime));
      }

      // 둘 다 일자만 설정된 경우는 더 이상 정렬하지 않음
      return 0;
    });
  },

  isNoEvent: function (eventData) {
    return !!(!eventData || eventData.length === 0);
  },
  hasImgView: function () {
    let type_col = 'type_col'
    if (CAC_LIST_VIEW.currentViewType === 'img_view') {
      type_col = CAC_UTIL.isMobile() ? 'type_col' : 'type_col2'
    }
    return type_col
  },
  buildLinksHtml: async function (event) {
    let linksHtml = '';
    if (event.external_link_url) {
      const hrefUrl =
          event.external_link_url.includes('http://') || event.external_link_url.includes('https://')
              ? event.external_link_url
              : 'https://' + event.external_link_url;
      const safeHref = CAC_VIEW.escapeHtml(hrefUrl);

      const socialBadge = this.socialBadge(event.external_link_type);
      linksHtml += `<a href="${safeHref}" class="list_link" target="_blank">${socialBadge}</a>`;
    }

    if (event.link_board_article && Object.keys(event.link_board_article).length > 0) {
      const boardLink = CAC_VIEW.getBoardLink(
          event.link_board_article.board_name,
          event.link_board_article.board_no,
          event.link_board_article.article_no,
      );
      linksHtml += `<a href="${boardLink}" class="list_link" target="_blank"><span class="ico_comm ico_post"></span>${CAC_UTIL.isMobile() ? '' : '게시글'}</a>`;
    }

    return linksHtml
  },
  buildGoogleCal: function(event) {
    const isUseThirdPartyCal = this.checkUseThirdPartyCal();
    let html = ''
    if (isUseThirdPartyCal) {
      html += `<a href="javascript:void(0)" onclick="CAC_LIST_VIEW.handleGoogleCalClick('${this.group_id}', '${event.id}', '${event.title}', '${event.start_datetime}', '${event.end_datetime}', '', '${event.is_day}')" class="list_link" style="width: 40px; height: 40px;border-radius: 50%;overflow: hidden;padding: 0;border: none;"><img src="https://m-img.cafe24.com/images/ec/calendar/ico_calendar_google.png" style="width: 100%" alt="구글 일정 바로가기" class="ico_shop"></a>`;
    }
    return html
  },
  buildProductsHtml: async function (event) {
    if (!event.link_products?.length) return '';
    const type_col = this.hasImgView();

    let productsHtml = `<ul class="prd_list ${type_col}">`;
    for (const product of event.link_products) {
      const productData = await CAC_CAFE24API.getProducts(product.product_no);
      if (!productData) continue;

      const productName = productData.product_name || product.product_name;
      const productPrice = productData.price || '';
      const productImage = productData.image || product.image;
      const soldOut = productData.sold_out === 'T' ? '<span class="soldout">SOLD OUT</span>' : '';
      const salePercent =
          productData.retail_price &&
          Number(productData.retail_price) > 0 &&
          Number(productData.retail_price) !== Number(productData.price)
              ? `<span class="num_sale" style="font-size: 16px">${Math.round(((Number(productData.retail_price) - Number(productData.price)) / Number(productData.retail_price)) * 100)}%</span>`
              : '';

      const itemNames = product.items.map((item) => item.item_name).join(', ');
      const itemName = itemNames ? `(${itemNames})` : '';

      productsHtml += `
      <li>
        <a href="${CAC_VIEW.getShopPath()}/product/detail.html?product_no=${product.product_no}" title="${productName} ${itemName}" class="prd_link" target="_blank">
          <span class="thumb_wrap">
            <img src="${productImage}" alt="${productName}" class="thumb_img">
            ${soldOut}
          </span>
          <div class="info_prd">
            <strong class="prd_tit">${productName}</strong>
            <span class="prd_price" style="font-size: 16px">
              ${salePercent}
              <em class="emph_num">${Number(productPrice).toLocaleString()}</em>원
            </span>
          </div>
        </a>
      </li>`;
    }
    return productsHtml + '</ul>';
  },
  buildPrdViewProductItemHtml: async function (productData, product, itemName, isMobile, isCol = false) {
    const productName = productData.product_name || product.product_name;
    const productPrice = productData.price || '';
    const productImage = productData.image || product.image;
    const soldOut = productData.sold_out === 'T' ? '<span class="soldout">SOLD OUT</span>' : '';
    const salePercent =
        productData.retail_price &&
        Number(productData.retail_price) > 0 &&
        Number(productData.retail_price) !== Number(productData.price)
            ? `<span class="num_sale" style="font-size: 16px">${Math.round(((Number(productData.retail_price) - Number(productData.price)) / Number(productData.retail_price)) * 100)}%</span>`
            : '';

    const detailLink = `${CAC_VIEW.getShopPath()}/product/detail.html?product_no=${product.product_no}`;
    const title = `${productData?.product_name ?? product.product_name} ${itemName}`;

    const infoHtml = `
      <div class="info_prd">
        <strong class="prd_tit">${productName}</strong>
        <span class="prd_price" style="font-size: 16px">
          ${salePercent}
          <em class="emph_num">${Number(productPrice).toLocaleString()}</em>원
        </span>
      </div>
    `;

    return `
      <li class="${!isCol && !isMobile ? 'swiper-slide' : ''}">
        <a href="${detailLink}" title="${title}" class="prd_link" target="_blank">
          <span class="thumb_wrap">
            <img src="${productImage}" alt="${productName}" class="thumb_img">
            ${soldOut}
          </span>
          ${isCol || !isMobile ? infoHtml : ''}
        </a>
      </li>
    `;
  },
  buildPrdViewProductsHtml: async function (event, isMobile) {
    if (!event.link_products?.length) return { productsHtml: '', productsColHtml: '' };

    const wrapHtml = (inner, type, extraClass = '') => {
      return `<ul class="prd_list ${type} ${extraClass}">${inner}</ul>`;
    }

    let rowItems = '';
    let colItems = '';

    for (const product of event.link_products) {
      const productData = await CAC_CAFE24API.getProducts(product.product_no);
      if (!productData) continue;

      const itemNames = product.items.map((item) => item.item_name).join(', ');
      const itemName = itemNames ? `(${itemNames})` : '';

      rowItems += await this.buildPrdViewProductItemHtml(productData, product, itemName, isMobile, false);
      colItems += await this.buildPrdViewProductItemHtml(productData, product, itemName, isMobile, true);
    }

    const productsHtml = `<div class="prd_list_wrap ${!isMobile ? 'swiper-container' : ''}">
                          ${wrapHtml(rowItems, 'type_row', !isMobile ? 'swiper-wrapper' : '')}
                        </div>`;
    const productsColHtml = wrapHtml(colItems, 'type_col');
    return { productsHtml, productsColHtml };
  },
  /** 카테고리 HTML 생성 */
  buildCategoriesHtml: async function (event) {
    if (!event.link_categories?.length) return '';
    const categoriesHTML = await CAC_VIEW.generateCategoriesHTML(event.link_categories, (html) => `<ul>${html}</ul>`);
    return `<div class="cate_wrap">${categoriesHTML}</div>`;
  },
  formatDateViewEventDate: function (event, startDate, endDate) {
    let showDate = '';
    if (event.is_day === 'T') {
      if (startDate.isSame(endDate, 'day')) {
        showDate = startDate.format('MM/DD');
      } else {
        showDate = `${startDate.format('MM/DD')} ~ ${endDate.format('MM/DD')}`;
      }
    } else {
      showDate = `${startDate.format('MM/DD')} ${startDate.format('A')} ${startDate.format('hh:mm')} ~ ${endDate.format('MM/DD')} ${endDate.format('A')} ${endDate.format('hh:mm')}`;
    }

    return showDate
  },
  formatEventDate: function (event, startDate, endDate) {
    let showDate = '';
    if (event.is_day === 'T') {
      if (startDate.isSame(endDate, 'day')) {
        showDate = startDate.format('MM/DD') + '(' + startDate.format('ddd') + ')'
      } else {
        showDate = `${startDate.format('MM/DD')}(${startDate.format('ddd')}) ~ ${endDate.format('MM/DD')}(${endDate.format('ddd')})`
      }
    } else {
      showDate = `${startDate.format('MM/DD')}(${startDate.format('ddd')})  ${startDate.format('HH:mm')} ~ ${endDate.format('MM/DD')}(${endDate.format('ddd')})  ${endDate.format('HH:mm')}`
    }

    return showDate;
  },
  buildThumbnailHtml: function (event) {
    const thumbnailImageUrl = event.img_view_thumbnail_image_url || '';
    const thumbnailLink = event.img_view_thumbnail_link || '';

    if (!thumbnailImageUrl) return '';

    const url =
        thumbnailLink.includes('http://') || thumbnailLink.includes('https://')
            ? encodeURI(thumbnailLink)
            : 'https://' + encodeURIComponent(thumbnailLink);

    return thumbnailLink
        ? `<div class="bnr_wrap"><a href="${url}" target="_blank"><img src="${thumbnailImageUrl}" alt="${event.title}" class="img_bnr"></a></div>`
        : `<div class="bnr_wrap"><img src="${thumbnailImageUrl}" alt="${event.title}" class="img_bnr"></div>`;
  },
  getTitleZoneStyle: function (condition, isMobile, pixel) {
    let style = "padding-bottom: 0px;"

    if(!isMobile && CAC_LIST_VIEW.currentViewType === 'img_view') {
      style = ''
    }

    if(isMobile && !condition) {
      style = `padding-bottom: ${pixel};`
    }

    return style;
  },
  /** 타이틀 영역 HTML 생성 */
  buildTitleZoneHtml: function ({event, startDate, endDate, statusBadge, showDate, linksHtml, collapsePCBtn, titleZoneStyle}) {
    const googleCalIcon = this.buildGoogleCal(event);
    if (CAC_UTIL.isMobile()) {
      return `
      <div class="title_zone" style="${titleZoneStyle}">
        <div class="inner_zone">
          <span class="date_txt"><span class="num_date">${startDate.format('MM/DD')}</span>(${startDate.format('ddd')})</span>
          <div class="inner_wrap">
            ${statusBadge}
            <button type="button" class="tit_btn">
              <strong class="list_tit">${event.title}</strong>
              <span class="txt_period">${showDate}</span>
            </button>
          </div>
        </div>
        ${linksHtml || googleCalIcon ? `<div class="link_wrap" style="display: flex; align-items: center;">${linksHtml}${googleCalIcon}</div>` : ''}
      </div>`;
    }

    return `
    <div class="title_zone">
      <span class="date_txt"><span class="num_date">${startDate.format('MM/DD')}</span>(${startDate.format('ddd')})</span>
      ${statusBadge}
      <button type="button" class="tit_btn">
        <strong class="list_tit" style="line-height: 24px;">${event.title}</strong>
        <span class="txt_period">${showDate}</span>
      </button>
      ${linksHtml || googleCalIcon ? `<div class="link_wrap" style="display: flex; align-items: center;">${linksHtml}${googleCalIcon}</div>` : ''}
      ${collapsePCBtn}
    </div>`;
  },
  buildCollapseBtnPC: function () {
    return CAC_UTIL.isMobile()
        ? ''
        : '<button type="button" class="drop_btn"><span class="ico_comm ico_drop">내용 열기</span></button>';
  },

  buildCollapseBtnMobile: function (event, condition) {
    return CAC_UTIL.isMobile() && condition
        ? '<button type="button" class="drop_btn"><span class="drop_txt">상세내역 보기</span><span class="ico_comm ico_drop"></span></button>'
        : '';
  },
  buildPrdViewTitleZone: function ({event, statusBadge, showDate, linksHtml, isMobile, cateHtml, productsColHtml}) {
    const collapsePCBtn = this.buildCollapseBtnPC();
    const googleCalIcon = this.buildGoogleCal(event);
    const condition = isMobile ? (event.description || linksHtml || productsColHtml || cateHtml) : (event.description || cateHtml)
    const titleZoneStyle = this.getTitleZoneStyle(
        condition,
        isMobile,
        '22px'
    );

    return `
    <div class="title_zone" style="${titleZoneStyle}">
      <div class="title_wrap">
        <button type="button" class="tit_btn">
          <span class="inner_wrap">
            ${statusBadge}
            <span class="txt_period">${showDate}</span>
          </span>
          <strong class="list_tit">${event.title}</strong>
        </button>
      </div>
      ${isMobile ? '' : `<div class="link_wrap" style="display: flex; align-items: center;">${linksHtml}${googleCalIcon}</div>`}
      ${collapsePCBtn}
    </div>
  `;
  },
  buildPrdViewContentZone: function (event, linksHtml, productsColHtml, cateHtml, isMobile,productsHtml) {
    const condition = isMobile ? (event.description || productsColHtml || linksHtml || cateHtml) : (event.description || cateHtml)
    const collapseMobileBtn = this.buildCollapseBtnMobile(event, (event.description || productsHtml || linksHtml || cateHtml));
    const googleCalIcon = this.buildGoogleCal(event);
    const description = event.description
        ? `<div class="cont_desc fr-view">${event.description}</div>`
        : '';
    if (!condition) {
      return '';
    }

    return `
    <div class="content_zone">
      ${description}
      ${isMobile && (linksHtml || googleCalIcon) ? `<div class="link_wrap" style="display: flex; align-items: center;">${linksHtml}${googleCalIcon}</div>` : ''}
      ${isMobile ? productsColHtml : ''}
      ${cateHtml}
    </div>
    ${collapseMobileBtn}
  `;
  },
  generateDateViewHtml: async function (eventData) {
    const startCalendar = this.getStartCalendar();
    if (this.isNoEvent(eventData)) {
      return `<li class="no_data">선택된 ${startCalendar === 'W' ? '날짜' : '월'}에 해당하는 일정이 없습니다.</li>`;
    }

    let html = '';
    const sortedEvents = this.sortEvents(eventData);

    for (const event of sortedEvents) {
      const startDate = moment(event.start_datetime);
      const endDate = moment(event.end_datetime);
      const statusBadge = this.statusBadge(startDate, endDate, event.is_day === 'T', event.is_complete === 'T');

      let linksHtml = await this.buildLinksHtml(event);

      let productsHtml = await this.buildProductsHtml(event);

      let cateHtml = await this.buildCategoriesHtml(event);

      const collapsePCBtn = this.buildCollapseBtnPC()
      const collapseMobileBtn = this.buildCollapseBtnMobile(event, (event.description || productsHtml || cateHtml))

      const showDate = this.formatDateViewEventDate(event, startDate, endDate)

      const titleZoneStyle = this.getTitleZoneStyle(event.description || productsHtml || cateHtml, CAC_UTIL.isMobile(), '22px')

      const titleZoneHtml = this.buildTitleZoneHtml({
        event, startDate, endDate, statusBadge, showDate, linksHtml, collapsePCBtn, titleZoneStyle
      })

      let description = '';
      if(event.description) {
        description = `<div class="cont_desc fr-view">${event.description}</div>`
      }
      html += `
        <li>
          ${titleZoneHtml}
          ${
          event.description || productsHtml || cateHtml
              ? `<div class="content_zone">
            ${description}
            ${productsHtml}
            ${cateHtml}
          </div>`
              : ''
      }
          ${event.description || productsHtml || cateHtml ? collapseMobileBtn : ''}
        </li>
      `;
    }

    return html;
  },
  generateImgViewHtml: async function (eventData) {
    const startCalendar = this.getStartCalendar();
    if (this.isNoEvent(eventData)) {
      return `<li class="no_data">선택된 ${startCalendar === 'W' ? '날짜' : '월'}에 해당하는 일정이 없습니다.</li>`;
    }

    let html = '';
    const sortedEvents = this.sortEvents(eventData);

    for (const event of sortedEvents) {
      const startDate = moment(event.start_datetime);
      const endDate = moment(event.end_datetime);
      const statusBadge = this.statusBadge(startDate, endDate, event.is_day === 'T', event.is_complete === 'T');

      let linksHtml = await this.buildLinksHtml(event)
      let googleCalIcon = this.buildGoogleCal(event);

      let productsHtml = await this.buildProductsHtml(event);

      let cateHtml = await this.buildCategoriesHtml(event);

      const thumbnailHtml = this.buildThumbnailHtml(event);

      const showDate = this.formatEventDate(event, startDate, endDate);

      const isShowCondition = event.description || productsHtml || cateHtml
      const collapsePCBtn = this.buildCollapseBtnPC()
      const collapseMobileBtn = this.buildCollapseBtnMobile(event, isShowCondition)

      const titleZoneStyle = this.getTitleZoneStyle(isShowCondition, CAC_UTIL.isMobile(), '15px')

      let description = '';
      if(event.description) {
        description = `<div class="cont_desc fr-view">${event.description}</div>`
      }

      html += `
        <li>
          ${thumbnailHtml}
          <div class="prd_tit_wrap">
            <div class="title_zone" style="${titleZoneStyle}">
              <div class="title_wrap">
                <button type="button" class="tit_btn">
                  <span class="inner_wrap">
                    ${statusBadge}
                    <span class="txt_period">${showDate}</span>
                  </span>
                  <strong class="list_tit">${event.title}</strong>
                </button>
              </div>
              ${linksHtml || googleCalIcon ? `<div class="link_wrap" style="display: flex; align-items: center;">${linksHtml}${googleCalIcon}</div>` : ''}
              ${collapsePCBtn}
            </div>
          </div>
          ${
          isShowCondition
              ? `<div class="content_zone">
            ${description}
            ${productsHtml}
            ${cateHtml}
          </div>`
              : ''
      }
          ${isShowCondition ? collapseMobileBtn : ''}
        </li>
      `;
    }

    return html;
  },
  generatePrdViewHtml: async function (eventData) {
    const isMobile = CAC_UTIL.isMobile();
    const startCalendar = this.getStartCalendar();
    if (this.isNoEvent(eventData)) {
      return `<li class="no_data">선택된 ${startCalendar === 'W' ? '날짜' : '월'}에 해당하는 일정이 없습니다.</li>`;
    }

    let html = '';
    const sortedEvents = this.sortEvents(eventData);

    for (const event of sortedEvents) {
      const startDate = moment(event.start_datetime);
      const endDate = moment(event.end_datetime);
      const statusBadge = this.statusBadge(startDate, endDate, event.is_day === 'T', event.is_complete === 'T');

      let linksHtml = await this.buildLinksHtml(event)

      const { productsHtml, productsColHtml } = await this.buildPrdViewProductsHtml(event, isMobile)

      let cateHtml = await this.buildCategoriesHtml(event);

      const showDate = this.formatEventDate(event, startDate, endDate);

      const titleZone = this.buildPrdViewTitleZone({event, statusBadge, showDate, linksHtml, isMobile, cateHtml, productsColHtml});
      const contentZone = this.buildPrdViewContentZone(event, linksHtml, productsColHtml, cateHtml, isMobile, productsHtml);

      html += `
      <li>
        <div class="prd_tit_wrap">
          ${titleZone}
          ${productsHtml}
        </div>
        ${contentZone}
      </li>
    `;
    }

    return html;
  },
  // 접근권한 체크
  checkPermission: function () {
    /**
     * 프론트에서 전체캘린더 노출시 기본설정의 접근권한을 타고,
     * 단독은 그룹의 접근 권한을 타고
     * this.basic_setting.front_use_permission === T:전체|F:회원만
     */
    const isMallAdmin = this.member_id === CAFE24API.MALL_ID;
    if (isMallAdmin) return true;

    // 전체 캘린더일 때
    if (this.groupId === null) {
      if (this.basic_setting?.front_use_permission === 'T') {
        const hasPermission = this.basic_setting.front_permission.some(
            (item) => item.group_no === CAC_LIST_VIEW.group_no
        );
        return !!hasPermission;
      }
      return true; // front_use_permission !== 'T'이면 기본 true
    }

    // 단독 캘린더일 때
    const group = this.calendar_group.find((g) => g._id === this.groupId);
    if (group?.single_calendar_use_front_permission === 'T') {
      const hasPermission = group.single_calendar_front_permission.some(
          (item) => item.group_no === CAC_LIST_VIEW.group_no
      );
      return !!hasPermission;
    }

    return true;
  },

  // 고객 캘린더 연동 여부 확인
  checkUseThirdPartyCal: function () {
    if (this.groupId) {
      const group = this.calendar_group.find((group) => group._id === this.groupId);
      return group && group.single_calendar_use_third_party_cal === 'T';
    } else {
      return this.basic_setting?.use_third_party_cal === 'T';
    }
  },
  handleGoogleCalClick: function (
    calendarGroupId,
    calendarId,
    title,
    start_datetime,
    end_datetime,
    description,
    allDay,
  ) {
    let startDate = ''
    let endDate = ''
    if (allDay === 'F') {
      startDate = encodeURIComponent(moment(start_datetime).format('YYYYMMDDTHHmmssZ'))
      endDate = encodeURIComponent(moment(end_datetime).format('YYYYMMDDTHHmmssZ'))
    } else {
      startDate = encodeURIComponent(moment(start_datetime).format('YYYYMMDD'))
      endDate = encodeURIComponent(moment(end_datetime).add(1, 'day').format('YYYYMMDD'))
    }
    const url =
      'https://calendar.google.com/calendar/u/0/r/eventedit?details={description}&text={title}&dates={start_datetime}/{end_datetime}'
        .replace('{title}', he.unescape(encodeURIComponent(title)))
        .replace(
          '{start_datetime}',
          start_datetime
            ? startDate
            : '',
        )
        .replace(
          '{end_datetime}',
          end_datetime
            ? endDate
            : '',
        )
        .replace('{description}', '');
    CAC_DATA.updateThirdPartyCalClickCount(calendarGroupId, calendarId, 'google');
    window.open(url, '_blank');
  },
};
