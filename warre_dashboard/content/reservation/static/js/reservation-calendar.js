$.fn.calendar = function (options) {
  let locale = (options.locale)? options.locale: 'en-US';
  moment.locale(locale);
  let dtStart = moment(options.dtStart, "DD/MM/YYYY"); // Set start of calendar
  let dtEnd = moment(options.dtEnd, "DD/MM/YYYY"); // Set end of calendar
  let countMonth = dtEnd.diff(dtStart, 'month'); // Check number of months between dates

  let firstDay = '01/'+dtStart.format('MM/YYYY'); // Get the first day of the start date
  let lastDay = dtEnd.endOf('month').format('DD') +'/'+dtEnd.format("MM/YYYY"); // Get the last day of the end date
  let countDays = 1 + moment(lastDay, "DD/MM/YYYY").diff(moment(firstDay, "DD/MM/YYYY"), 'days'); // checks the number of days between dates
  let slots = options.data;
  let divCalendar = $(this);
  let unic = divCalendar.attr('id')+'_'+moment().format('s'); // Create a single ID to manipulate table
  let idThead = '#thead_'+unic;
  let idTbody = '#tbody_'+unic;
  let conflicts = '#conflicts_'+unic;
  let tooltipShow = (options.tooltipShow === false)? false: true;

  //return this.each(function () {
  $(this).css({"margin-left": "auto", "margin-right": "auto", "width": "100%"});
  let table = `<div id="conflicts_${unic}"></div><div></div>
              <table class="tb-calendar" id="${unic}">
                  <thead id="thead_${unic}">
                  </thead>
                  <tbody id="tbody_${unic}">
                  </tbody>
              </table>
              `;
  $(this).html(table);

  // Assemble the month header
  var headerMonthTable = '<th></th>';
  for(let i = 0; i <= countMonth; i++){
      let month = moment(dtStart, "DD/MM/YYYY").add(i, "month").format('MMMM/YYYY');
      let countDaysMonth = moment(dtStart, "DD/MM/YYYY").add(i, "month").endOf('month').format('DD');
      let classMonth = (i % 2 == 0)? 'month-name-odd': 'month-name-par';
      headerMonthTable += `<th class="${classMonth}" colspan="${countDaysMonth}">${month}</th>`;
  }
  $(idThead).html('<tr>'+headerMonthTable+'</tr>');

  // Assemble the days header
  var headerDaysTable = '<th></th>';
  for(let i = 0; i <= countDays-1; i++){
      let day = moment(firstDay, "DD/MM/YYYY").add(i, "days").format('DD');
      let dayNumber = moment(firstDay, "DD/MM/YYYY").add(i, "days").dayOfYear();
      headerDaysTable += `<th class="days" day_number="${dayNumber}"><p>${day}</p></th>`;
  }
  $(idThead).append('<tr>'+headerDaysTable+'</tr>');

  // Maps all dependency IDs
  let deps = $.map(slots, function(val, i){
      if(val.dep){
          return val.dep.split(',');
      }
  });

  var resConflicts = '';
  $.each(slots, function(index, slot) {
      if(deps.indexOf(slot.id.toString()) < 0 && slot.date_start && slot.date_end){
          let d1 = moment(slot.date_start, "YYYY-MM-DD");
          let d2 = moment(slot.date_end, "YYYY-MM-DD");
          let slotName = (slot.name)? slot.name: '';
          let titleName = (slot.title)? slot.title: slotName;
          let slotColor = (slot.color)? slot.color: '#ADFF2F';
          let daysCount = d2.diff(d1, 'days') + 1;
          let labelT = (options.labelTask)? slotName: '';
          let classTd = (index % 2 == 0)? 'td-bg1': 'td-bg2';

          var slotsTable = '<tr>';
          slotsTable += `<th colspan="1"><p>&nbsp;&nbsp;${titleName}</p></th>`;
          let colspanStart = moment(slot.date_start, "YYYY-MM-DD").diff(moment(firstDay, "DD/MM/YYYY"), 'days');
          
          if(colspanStart){ // Complete before slot
              slotsTable += checkCellColspan('start', slot, colspanStart, slotName, classTd, slotColor, labelT);
          }
          // slot itself
          slotsTable += checkCellColspan('slot', slot, daysCount, slotName, classTd, slotColor, labelT);
          if(slot.dep){ // If there are dependency activities, pass to the function that assembles dependencies
              let contentDep = loadDep(slots, slot.dep, classTd, slot.date_end);
              slotsTable += contentDep.content;
              resConflicts += contentDep.conflicts;
          }

          // Complete after slot
          let colspanEnd = moment(lastDay, "DD/MM/YYYY").diff(moment(slot.date_end, "YYYY-MM-DD"), 'days');
          if(colspanEnd){
              slotsTable += checkCellColspan('end', slot, colspanEnd, slotName, classTd, slotColor, labelT);
          }
          $(idTbody).append(slotsTable);
      }

      // If there is a click event definition. Assign it to the td of the activity
      if(options.click){
          $('.td-slots').off('click');
          $('.td-slots').css('cursor','pointer').on('click', function(){
              options.click($(this).attr('slot_id'), $(this).attr('slot_name'), $(this).attr('slot_days'));
          });
      }

      $('#tbody_'+unic+' > tr > .td-slots').off('mouseover','**');
      $('#tbody_'+unic+' > tr > .td-slots').off('mousemove','**');
      $('#tbody_'+unic+' > tr > .td-slots').off('mouseout','**');
      if(tooltipShow){
          $('#tbody_'+unic+' > tr > .td-slots').on('mouseover', function(){ // Create the tooltip when hovering over the activity
              let tooltipCalendar = `<div class="tooltip-calendar">
                                  <b>${$(this).attr('slot_name')}</b><br>
                                  <span>${$(this).attr('start')} a ${$(this).attr('end')}</span><br>
                                  <span>${$(this).attr('slot_days')} dias</span>
                                  <hr>
                                  <span>${$(this).attr('tooltip_desc')}</span>
                                  </div>`;
              $('body').append(tooltipCalendar);
              $('.tooltip-calendar').css('z-index', 10000);
              //$('.tooltip-calendar').fadeIn('500');
              //$('.tooltip-calendar').fadeTo('10', 1.9);
          });

          $('#tbody_'+unic+' > tr > .td-slots').on('mousemove', function(e){ // Drag the tooltip according to the mouse
              $('.tooltip-calendar').css('top', e.pageY + 10);
              $('.tooltip-calendar').css('left', e.pageX + 20);
          });

          $('#tbody_'+unic+' > tr > .td-slots').on('mouseout', function(){ // Removes tooltip when mouse is removed from activity
              $('.tooltip-calendar').remove();
          });
      }
  });
  // Shows conflicting slots
  $(conflicts).html(resConflicts);

  /**
   * Assemble cell
   * @param {*} type 'start' = create tds before slot | 'slot' = create slot tds | 'end' = create tds after slot
   * @param {*} slot Task being passed to populate td
   * @param {*} qtdColspan Amount of colspan to define the width of the td
   * @param {*} originQtdColspan Original quantity of colspan which is the same as quantity of days
   * @param {*} slotName Task name
   * @param {*} classTd css class that will be applied to td
   * @param {*} slotColor Task color
   * @param {*} labelT Name of the slot that will be displayed according to the parameter labelTask true or false
   * @param {*} borderRadius Defines which rounding edge will be used
   */
  function fillsCell(type, slot, qtdColspan, originQtdColspan, slotName, classTd, slotColor, labelT, borderRadius){
      let tdCell = '';
      if(type == 'start'){
          tdCell += `<td class="${classTd}" colspan="${qtdColspan}"></td>`;
      }
      if(type == 'slot'){
          let start = moment(slot.date_start, "YYYY-MM-DD").format('DD/MM/YY');
          let end = moment(slot.date_end, "YYYY-MM-DD").format('DD/MM/YY');
          let tooltipDesc = (slot.tooltip_desc)? slot.tooltip_desc: '';
          tdCell += `<td class="${classTd} td-slots" start="${start}" end="${end}" slot_id="${slot.id}" slot_name="${slotName}" slot_days="${originQtdColspan}" tooltip_desc="${tooltipDesc}" colspan="${qtdColspan}">
                                  <div class="div-slot ${borderRadius}" style="background-color: ${slotColor};">${labelT}</div>
                              </td>`;
      }
      if(type == 'end'){
          tdCell += `<td class="${classTd}" colspan="${qtdColspan}"></td>`;
      }
      return tdCell;
  }

  /**
   * Checks amount of colspan cell
   * @param {*} type 'start' = cria tds antes da tarefa | 'slot' = cria tds da tarefa | 'end' = cria tds depois da tarefa
   * @param {*} type 'start' = create tds before slot | 'slot' = create slot tds | 'end' = create tds after slot
   * @param {*} qtdColspan Amount of colspan to define the width of the td
   * @param {*} slotName Task name
   * @param {*} classTd css class that will be applied to td
   * @param {*} slotColor Task color
   * @param {*} labelT Name of the slot that will be displayed according to the parameter labelTask true or false
   */
  function checkCellColspan(type, slot, qtdColspan, slotName, classTd, slotColor, labelT){
      let cell = '';
      let originQtdColspan = qtdColspan;
      if(qtdColspan < 1000){ // If colspan quantity is less than 1000
          cell += fillsCell(type, slot, qtdColspan, originQtdColspan, slotName, classTd, slotColor, labelT, 'border-radius-full');
      }
      let countLoop = 1;
      while(qtdColspan > 1000){ // As long as colspan quantity is greater than 1000, it enters the loop until it is less than 1000
          if(qtdColspan > 1000){
              let borderRadius = '';
              if(countLoop == 1){
                  borderRadius = 'border-radius-left';
              }
              cell += fillsCell(type, slot, 1000, originQtdColspan, slotName, classTd, slotColor, labelT, borderRadius);
          }
          qtdColspan = qtdColspan - 1000;
          if(qtdColspan < 1000){ // If colspan amount reaches an amount less than 1000
              cell += fillsCell(type, slot, qtdColspan, originQtdColspan, slotName, classTd, slotColor, labelT, 'border-radius-right');
          }
          countLoop++;
      }
      return cell;
  }

  /**
   * Load dependent activities if you have any
   * @param {*} Json date with the data
   * @param {*} ids Ids of activities that are dependent
   * @param {*} classTd Classe de background-color
   * @param {*} currentDate Current date of the parent activity
   * @param {*} firstDay Calendar start date
   */
  function loadDep(data, ids, classTd, lastDate){
      var content = '';
      var contentConflicts = '';
      $.each(ids.split(','), function(index, id) {

          $.map(data, function(val, i){
              // In the mapping, if the json id is equal to the id of some dependency and if the dependency date is greater than the current date. Assemble block
              if(val.id == id){
                  if(moment(val.date_start, "YYYY-MM-DD").isAfter(moment(lastDate, 'YYYY-MM-DD'))){

                      let d1S = moment(val.date_start, "YYYY-MM-DD");
                      let d2S = moment(val.date_end, "YYYY-MM-DD");
                      let slotNameS = (val.name)? val.name: '';
                      let slotColorS = (val.color)? val.color: '#2E8B57';
                      let daysCountS = d2S.diff(d1S, 'days') + 1;
                      let colspanStartS = d1S.diff(moment(lastDate, "YYYY-MM-DD"), 'days') - 1;
                      let labelTS = (options.labelTask)? slotNameS: '';

                      if(colspanStartS){ // Complete before slot
                          content += checkCellColspan('start', val, colspanStartS, slotNameS, classTd, slotColorS, labelTS);
                      }

                      content += checkCellColspan('slot', val, daysCountS, slotNameS, classTd, slotColorS, labelTS);
                      lastDate = d2S;
                  }else{
                      contentConflicts = `<p>${val.name} (ID: ${val.id}) - Início: ${moment(val.date_start, "YYYY-MM-DD").format('DD/MM/YYYY')} Fim: ${moment(val.date_end, "YYYY-MM-DD").format('DD/MM/YYYY')} esta conflitando</p>`;
                  }
              }
          });

      });
      return {
          content: content,
          conflicts: contentConflicts
      };
  }

  $(function() {
      $('#'+unic).scroll(function(ev) {
          /**
           * When the table scrolls we use the scroll offset to move
           * the axis to the correct place. Use a CSS transform rather
           * that just setting the left and top properties so we keep
           * the table sizing (no position change) and because
           * transforms are hardware accelerated.
           */
          $('#'+unic+'.tb-calendar thead th').css({'transform':'translateY(' + this.scrollTop + 'px)'});

          // There are better ways to handle this, but this make the idea clear.
          $('#'+unic+'.tb-calendar tbody th').css({'transform': 'translateX(' + this.scrollLeft + 'px)'});
      });
  });
};