/**
  * Nectar Reservations Table JS
  * Adapted by ARDC Core Services 
  * from easy-gantt.js using JQuery and Moment.js
  * by Tiago Silva Costa (https://github.com/tiagotsc/easy-gantt)
  **/
 
$.fn.gantt = function (options) {
    let locale = (options.locale)? options.locale: 'en-US';
    moment.locale(locale);
    let dtStart = moment(options.dtStart, "DD/MM/YYYY"); // Set start of calendar
    let dtEnd = moment(options.dtEnd, "DD/MM/YYYY"); // Set end of calendar
    let countMonth = dtEnd.diff(dtStart, 'month'); // Check number of months between dates

    let firstDay = '01/'+dtStart.format('MM/YYYY') // Get the first day of the start date
    let lastDay = dtEnd.endOf('month').format('DD') +'/'+dtEnd.format("MM/YYYY"); // Get the last day of the end date
    let countDays = 1 + moment(lastDay, "DD/MM/YYYY").diff(moment(firstDay, "DD/MM/YYYY"), 'days'); // checks the number of days between dates
    let tasks = options.data;
    let divGantt = $(this);
	let unic = divGantt.attr('id')+'_'+moment().format('s'); // Create a single ID to manipulate table
	let idThead = '#thead_'+unic;
	let idTbody = '#tbody_'+unic;
    let conflicts = '#conflicts_'+unic;
    let tooltipShow = (window.matchMedia("(max-width: 767px)").matches === true)? false: true; // only show the tooltip if the screen is not a mobile device

    //return this.each(function () {
    $(this).css({"margin-left": "auto", "margin-right": "auto", "width": "100%"});
    let table = `<div id="conflicts_${unic}"></div><div></div>
                <table class="table tb-gantt" id="${unic}">
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
        let date = moment(firstDay, "DD/MM/YYYY").add(i, "days");
        let day = date.format('DD');
        let dayNumber = moment(firstDay, "DD/MM/YYYY").add(i, "days").dayOfYear();
        if(date.isSame(moment(), 'day')){ // is current day the same as today?
            headerDaysTable += `<th class="days today" day_number="${dayNumber}"><p>${day}</p></th>`;
        }
        else {
            headerDaysTable += `<th class="days" day_number="${dayNumber}"><p>${day}</p></th>`;
        }
    }
    $(idThead).append('<tr>'+headerDaysTable+'</tr>');

    // Maps all dependency IDs
    let deps = $.map(tasks, function(val, i){
        if(val.dep){
            return val.dep.split(',');
        }
    });

    var resConflicts = '';
    $.each(tasks, function(index, task) {
        let d1 = moment(task.date_start, "DD/MM/YYYY");
        let d2 = moment(task.date_end, "DD/MM/YYYY");
        let taskId = (task.id)? task.id: '';
        let taskName = (task.name)? task.name: '';
        let parentId = (task.parent_id)? task.parent_id: '';
        let titleName = (task.title)? task.title: taskName;
        let taskColor = (task.color)? task.color: '#ADFF2F';
        let daysCount = d2.diff(d1, 'days') + 1;
        let labelT = (options.labelTask)? taskName: '';
        let classTd = (index % 2 == 0)? 'td-bg1': 'td-bg2';
        let details = (task.details)? task.details : '';
        let tooltipGantt = `<div class="tooltip-gantt" id="tooltip_${taskId}">
                                <strong>${taskName}</strong><br>
                                <span class="tooltip-date">${d1} to ${d2}</span><br>
                                <span class="tooltip-days">${daysCount} days</span>
                                <hr>
                                <div class="small">${detailsMarkup(details)}</div>
                                </div>`;
        
        $('body').append(tooltipGantt);
        

        if(deps.indexOf(task.id.toString()) < 0 && task.date_start && task.date_end) {

            var tasksTable = '<tr>';
            
            if(details) {
                tasksTable += `<th><p data-toggle="collapse" class="h5 collapsed" data-target="#details_${parentId}">${titleName}</p>`;
                tasksTable += '<div class="collapse" id="details_' + parentId + '">';
                tasksTable += detailsMarkup(details);
                tasksTable += '</div></th>';
            }
            else {
                tasksTable += `<th><p class="h5">${titleName}</p>`;
                tasksTable += '</th>';
            }
            
            let colspanStart = moment(task.date_start, "DD/MM/YYYY").diff(moment(firstDay, "DD/MM/YYYY"), 'days');
            if(colspanStart){ // Complete before slot
                tasksTable += checkCellColspan('start', task, colspanStart, taskName, classTd, taskColor, labelT);
            }
            // slot itself
            tasksTable += checkCellColspan('task', task, daysCount, taskName, classTd, taskColor, labelT);
            if(task.dep){ // If there are dependency activities, pass to the function that assembles dependencies
                let contentDep = loadDep(tasks, task.dep, classTd, task.date_end);
                tasksTable += contentDep.content;
                resConflicts += contentDep.conflicts;
            }

            // Complete after slot
            let colspanEnd = moment(lastDay, "DD/MM/YYYY").diff(moment(task.date_end, "DD/MM/YYYY"), 'days');
            if(colspanEnd){
                tasksTable += checkCellColspan('end', task, colspanEnd, taskName, classTd, taskColor, labelT);
            }
            $(idTbody).append(tasksTable);
        }

        // If there is a click event definition. Assign it to the td of the activity
        if(options.click){
            $('.td-tasks .div-task').off('click');
            $('.td-tasks .div-task').css('cursor','pointer').on('click', function(){
                options.click($(this).parent().attr('task_id'), $(this).parent().attr('task_name'), $(this).parent().attr('start'), $(this).parent().attr('end'), $(this).parent().attr('task_days'));
            });
        }
    });

    // $('#tbody_'+unic+' .div-task').off('mouseover','**');
    // $('#tbody_'+unic+' .div-task').off('mousemove','**');
    // $('#tbody_'+unic+' .div-task').off('mouseout','**');
    if(tooltipShow){
        $('#tbody_'+unic+' > tr > .td-tasks .div-task').on('mouseover', function(){ // Cria o tooltip ao passar o mouse na atividade
            $('#tooltip_' + $(this).parent().attr('task_id')).css('display', 'inline-block');
            //$('.tooltip-gantt').fadeIn('500');
            //$('.tooltip-gantt').fadeTo('10', 1.9);
        });

        $('#tbody_'+unic+' > tr > .td-tasks .div-task').on('mousemove', function(e){ // Arrasta o tooltip de acordo com o mouse
            $('#tooltip_' + $(this).parent().attr('task_id')).css('top', e.pageY + 10);
            $('#tooltip_' + $(this).parent().attr('task_id')).css('left', e.pageX + 20);
        });

        $('#tbody_'+unic+' > tr > .td-tasks .div-task').on('mouseout', function(){ // Remove o tooltip ao tirar o mouse da atividade
            $('#tooltip_' + $(this).parent().attr('task_id')).css('display', 'none');
        });
    }
    $('.tooltip-gantt').css('display', 'none');
    $('.tooltip-gantt').css('z-index', 10000);

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
    function fillsCell(type, task, qtdColspan, originQtdColspan, taskName, classTd, taskColor, labelT, borderRadius){
        let tdCell = '';
        if(type == 'start'){
            tdCell += `<td class="${classTd}" colspan="${qtdColspan}"></td>`;
        }
        if(type == 'task'){
            let start = moment(task.date_start, "DD/MM/YYYY").format('DD/MM/YYYY');
            let end = moment(task.date_end, "DD/MM/YYYY").format('DD/MM/YYYY');
            let tooltipDesc = (task.tooltip_desc)? task.tooltip_desc: '';
            let maxDuration = (task.details.max_duration).split(" ")[0]; // Get the number from first part of string containing "days" as a prefix
            tdCell +=   `<td class="${classTd} td-tasks" start="${start}" end="${end}" task_id="${task.id}" task_name="${taskName}" task_days="${originQtdColspan}" task_max_days="${maxDuration}" tooltip_desc="${tooltipDesc}" colspan="${qtdColspan}">
                            <div class="div-task ${borderRadius}" style="background-color: ${taskColor};">${labelT}<span class="show-hover"></span></div>
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
    function checkCellColspan(type, task, qtdColspan, taskName, classTd, taskColor, labelT){
        let cell = '';
        let originQtdColspan = qtdColspan;
        if(qtdColspan < 1000){ // If colspan quantity is less than 1000
            cell += fillsCell(type, task, qtdColspan, originQtdColspan, taskName, classTd, taskColor, labelT, 'border-radius-full');
        }
        let countLoop = 1;
        while(qtdColspan > 1000){ // As long as colspan quantity is greater than 1000, it enters the loop until it is less than 1000
            if(qtdColspan > 1000){
                let borderRadius = '';
                if(countLoop == 1){
                    borderRadius = 'border-radius-left';
                }
                cell += fillsCell(type, task, 1000, originQtdColspan, taskName, classTd, taskColor, labelT, borderRadius);
            }
            qtdColspan = qtdColspan - 1000;
            if(qtdColspan < 1000){ // If colspan amount reaches an amount less than 1000
                cell += fillsCell(type, task, qtdColspan, originQtdColspan, taskName, classTd, taskColor, labelT, 'border-radius-right');
            }
            countLoop++;
        }
        return cell;
    }

    function detailsMarkup(rowDetails){
        var details = '<p>';

        $.each(rowDetails, function(key,value) {
            label = key.split('_').join(' ');
            details += '<strong class="text-capitalize">' + label + ':</strong> ' + value + '<br />';
        });

        details += '</p>';

        return details;
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
                    if(moment(val.date_start, "DD/MM/YYYY").isAfter(moment(lastDate, 'DD/MM/YYYY'))){

                        let d1S = moment(val.date_start, "DD/MM/YYYY");
                        let d2S = moment(val.date_end, "DD/MM/YYYY");
                        let taskIdS = (val.id)? val.id: '';
                        let taskNameS = (val.name)? val.name: '';
                        let parentIdS = (val.parent_id)? val.parent_id: '';
                        let titleNameS = (val.title)? val.title: taskNameS;
                        let taskColorS = (val.color)? val.color: '#2E8B57';
                        let daysCountS = d2S.diff(d1S, 'days') + 1;
                        let labelTS = (val.labelTask)? taskNameS: '';
                        let colspanStartS = d1S.diff(moment(lastDate, "DD/MM/YYYY"), 'days') - 1;
                        // let labelTS = (options.labelTask)? taskNameS: '';
                        let detailsS = (val.details)? val.details : '';
                        let tooltipGanttS = `<div class="tooltip-gantt" id="tooltip_${taskIdS}">
                                                <strong>${taskNameS}</strong><br>
                                                <span class="tooltip-date">${d1S} to ${d2S}</span><br>
                                                <span class="tooltip-days">${daysCountS} days</span>
                                                <hr>
                                                <div class="small">${detailsMarkup(detailsS)}</div>
                                                </div>`;
                        $('body').append(tooltipGanttS);

                        if(colspanStartS){ // Complete before slot
                            content += checkCellColspan('start', val, colspanStartS, taskNameS, classTd, taskColorS, labelTS);
                        }

                        content += checkCellColspan('task', val, daysCountS, taskNameS, classTd, taskColorS, labelTS);
                        lastDate = d2S;
                    }else{
                        contentConflicts = `<p>${val.name} (ID: ${val.id}) - Início: ${moment(val.date_start, "DD/MM/YYYY").format('DD/MM/YYYY')} Fim: ${moment(val.date_end, "DD/MM/YYYY").format('DD/MM/YYYY')} esta conflitando</p>`;
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
            $('#'+unic+'.tb-gantt thead th').css({'transform':'translateY(' + this.scrollTop + 'px)'});

            // There are better ways to handle this, but this make the idea clear.
            $('#'+unic+'.tb-gantt tbody th').css({'transform': 'translateX(' + this.scrollLeft + 'px)'});
        });
    });
};
