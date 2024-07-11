/**
  * Nectar Reservations
  * Author: Darcelle Malby (d.malby@uq.edu.au)
  * Company: Australian Research Data Commons
  * Website: https://ardc.edu.au
  * Copyright: © 2021 ARDC Nectar Research Cloud
  **/

var reservationAvailabilty = (function() {

  var time_zone = "UTC";
  var reservations = {};
  var reservation_data = {};
  var category = "";
  var availabilty_zone = "";
  // var max_hours;
  // var total_hours_used;
  var max_days = 0;
  var total_days_used = 0;
  var max_days_eligible = 0; // The project max days remaining 
  var max_reservations;
  var total_reservations_used;
  var max_reservations_eligible;
  var max_su = 0;
  var total_su_used = 0;
  var selected_start;
  var selected_end;
  var selected_days; // The number of days selected
  var selected_su;
  var selected_flavor;
  var selected_max_days; // The flavor policy max days
  var selected_max_days_available; // The flavor time slot days available
  var selected_days_remaining; // The flavor policy days remaining after total days from today to current reservation end date
  var selected_max_days_eligible; // The smaller number of days eligible to book considering flavor and project limits
  var selected_usage_rate = 0;
  var start_time;
  var end_time;
  var current_end_datetime;
  var current_end_date;

  // var max_su_eligible = 0;

  /* Private function to convert string to number with 2 decimal places */
  function convertToFloat(str_num) {
    return Math.round(Number(str_num) * 100) / 100;
  }

  function hoursToDays(str_num) {
    return Math.floor(Number(str_num) / 24);
  }

  /* Private function to get reservation calendar data */
  function getReservationsData() {
    const data_end = moment.tz(time_zone).add(3, 'months').format('YYYY-MM-DD');

    var api_url = "/api/warre/flavor-slots/?category=" + category + "&availability_zone=" + availabilty_zone + "&end=" + data_end;

    return new Promise((resolve, reject) => {
      $.ajax({
        url: api_url,
        type: 'GET',
        success: function (data) {
          // Is data object empty?
          if($.trim(data.slots)) {
            resolve(data.slots);
          }
          else {
            reject("Data empty!");
          }
        },
        error: function (error) {
          reject(error)
        },
      });
    });
  }

  /* Private function to get flavor availabilty data */
  function getFlavorData() {
    var data_start = moment(current_end_date, "DD/MM/YYYY").format('YYYY-MM-DD');
    var data_end = moment(current_end_date, "DD/MM/YYYY").add(selected_max_days, "days").format('YYYY-MM-DD');

    var api_url = "/api/warre/flavor-slots/" + selected_flavor + "/?start=" + data_start + "&end=" + data_end;
    //console.log(api_url);
    return new Promise((resolve, reject) => {
      $.ajax({
        url: api_url,
        type: 'GET',
        success: function (data) {
          // Is data object empty?
          if($.trim(data.slots)) {
            resolve(data.slots[0]);
          }
          else {
            reject("Data empty!");
          }
        },
        error: function (error) {
          reject(error)
        },
      });
    });
  }

  /* Private function to format the data to display correctly in the table */
  function formatSlotData(object_data) {

    let new_format = [];
    let index = 1;

    object_data.forEach(item => {
      var flavor_size = item.flavor.vcpu + "VCPUs " + item.flavor.memory_mb + "MB RAM";
      var disk_size = item.flavor.disk_gb + "GB";
      if(item.flavor.ephemeral_gb > 0) {
        disk_size += (" + " + item.flavor.ephemeral_gb + "GB (ephemeral)");
      }

      var time_slot = {
        id: index,
        parent_id: item.flavor.id,
        title: item.flavor.name,
        name: item.flavor.name,
        date_start: getLocalStartDay(item.start),
        date_end: getLocalEndDay(item.end),
        color: '#81d033',
        details: {
          class: item.flavor.category,
          description: item.flavor.description,
          availability_zone: item.flavor.availability_zone,
          size: flavor_size,
          disk:  disk_size,
          max_duration: hoursToDays(item.flavor.max_length_hours) + " days",
          usage_rate: item.flavor.extra_specs["nectar:rate"] ? (item.flavor.extra_specs["nectar:rate"] + " SU/hour") : "FREE",
        }
      };

      if(new_format.some(el => el.parent_id === item.flavor.id)) {
        let slot = new_format.find((o, i) => {
          if(o.parent_id === item.flavor.id) {
            const dep_string = new_format[i].dep ? new_format[i].dep : "";
            // console.log(dep_string);
            let dep_array = dep_string !== "" ? dep_string.split(",") : [];
            // console.log(dep_array);
            dep_array.push(index);
            new_format[i].dep = dep_array.toString();

            return true; // stop searching
          }
        });
        // console.log(slot);
      }

      new_format.push(time_slot);
      index++;
    });
    // console.log(new_format);
    return new_format;
  }

  /* Private function to render the reservations table */
  function displayReservationsTable() {
    getReservationsData()
      .then((data) => {
        console.log(data);
        reservation_data = formatSlotData(data);
        console.log(reservation_data);
        $(".reservations-error").hide();
        $('#reservations_table').show();
        clearTooltips();
        $('#reservations_table').gantt({
          dtStart: moment.tz(time_zone).format('DD/MM/YYYY'),
          dtEnd: moment.tz(time_zone).add(3, 'months').format('DD/MM/YYYY'),
          timeZone: time_zone,
          locale:'en-AU',
          height: 500,
          labelTask: false,
          data: reservation_data,
          click: function(taskId, taskName, taskStart, taskEnd, taskCountDays) {
            // console.log('Clicked!', taskId, taskName, taskCountDays);
            displayReserveModal(taskId);
          }
        });
        activateSlotMouseover();
      })
      .catch((error) => {
        console.error(error);
        if(error === "Data empty!") {
          $('#reservations_table').hide();
          $(".reservations-error").show();
        }
      });
  }

  /* Private function to remove tooltips from the DOM when new slot data is drawn in the table. */
  function clearTooltips() {
    $( ".tooltip-gantt" ).remove();
  }

  // function isTodayUTC() {
  //   today_utc = moment.utc().format('DD/MM/YYYY');
  //   today_local = moment.tz(time_zone).format('DD/MM/YYYY');
  //   return today_utc == today_local;
  // }

  function getLocalStartDay(start_time) {
    var today = moment.tz(time_zone);
    var utc_start_day = moment.utc(start_time).format("DD/MM/YYYY");

    if(moment(start_time).isSame(today, "day")) {
      // Start from now
      local_start_day = today.format("DD/MM/YYYY");
    }
    else {
      // Start in future
      if(moment(utc_start_day, "DD/MM/YYYY").isBefore(start_time, 'day')) {
        // UTC before
        var local_start_day = moment(start_time).subtract(1, "days").format("DD/MM/YYYY");
      }
      else if(moment(utc_start_day, "DD/MM/YYYY").isAfter(start_time, 'day')) {
        // UTC after
        var local_start_day = moment(start_time).add(1, "days").format("DD/MM/YYYY");
      }
      else {
        var local_start_day = utc_start_day;
      }
    }
    return local_start_day;
  }


  function getLocalEndDay(end_time) {
    var utc_end_day = moment.utc(end_time).format("DD/MM/YYYY");
    if(moment(utc_end_day, "DD/MM/YYYY").isBefore(end_time, 'day')) {
      // UTC before
      var local_end_day = moment(end_time).subtract(1, "days").format("DD/MM/YYYY");
    }
    else if(moment(utc_end_day, "DD/MM/YYYY").isAfter(end_time, 'day')) {
      // UTC after
      var local_end_day = moment(end_time).add(1, "days").format("DD/MM/YYYY");
    }
    else {
      var local_end_day = utc_end_day;
    }
    return local_end_day;
  }

  /* Private function to get details of a flavor and return as html formatted string */
  function getDetails(details) {

    var details_string = "<p>";

    $.each( details, function( key, value ) {
      label = key.split('_').join(' ');
      details_string += ("<strong class='text-capitalize'>" + label + ":</strong> " + value + "<br />");
    });

    details_string += "</p>";

    return details_string;
  }

  /* Private function to initialize bootstrap daterangepicker with selected dates */
  function showDateRange(slot_start, slot_end) {
    $('input[name="daterange"]').daterangepicker({
      opens: 'left',
      startDate: selected_start,
      endDate: selected_end,
      minDate: slot_start,
      maxDate: slot_end,
      maxSpan: {
        "days": (selected_max_days_eligible - 1)
      },
      // parentEl: "#main_body",
      locale: {
        format: 'DD/MM/YYYY'
      }
    }, function(begin, end, label) {
      updateDateRange(begin, end);
      console.log("A new date selection was made: " + begin.format('DD/MM/YYYY') + ' to ' + end.format('DD/MM/YYYY'));
    });
  }

  /* Private function to show max days shaded hover block on time slot */
  function activateSlotMouseover() {
    $(".div-task").each(function() {
      // Determine max days and set hover block width for each time slot
      selected_max_days = $(this).parent().attr('task_max_days');
      var hover_size = Math.min(max_days_eligible, selected_max_days); // The smaller number of days eligible to book for the flavor
      var slot_available_days = Number($(this).parent().attr('task_days'));
      var hover_width_percent = hover_size / slot_available_days * 100;
      var div_width = $(this).width();
      var day_width = div_width / slot_available_days;
      let slot_hover = $(this).find('.show-hover');

      // Create mousemove event for each time slot div
      $(this).mousemove(function(e) {
        var div_x = $(this).offset().left;
        var rel_x = e.pageX - div_x;
        var second_day_x = day_width;

        if(hover_size < slot_available_days) {
          // Only adjust hover shadow width if hover days is less than the slot number of days
          slot_hover.css('width', hover_width_percent + "%");
        }

        showHover($(this), rel_x); // Show hover block on start date of the mouse location
        getDatesFromTable($(this), rel_x); // Get the time slot hover dates to update tooltip and modal
      });
    });
  }

  /* Private function to show hover shadow at the x pixel offset of each day in table when mouse moves over the time slot div */
  function showHover(div_element, pixel_left_pos) {
    var div_width = div_element.width();
    var slot_available_days = Number(div_element.parent().attr('task_days'));
    var day_width = div_width / slot_available_days;
    var day_positions = []; // New array to store starting pixel x offsets for each day in the available time slot
    day_positions[0] = 0; // Set first element to 0 (pixel offset)

    for(var i = 1; i < (slot_available_days); i++) {
      day_positions[i] = (day_positions[i-1] + day_width);
    }

    let hover_pos = day_positions.concat(pixel_left_pos).sort((a, b) => a - b).indexOf(pixel_left_pos);
    let start_day_pos = hover_pos > 0 ? hover_pos - 1 : 0;

    div_element.find(".show-hover").css({'left': day_positions[start_day_pos]});
  }

  /* Private function to update the date range displayed in the tooltip and modal */
  function getDatesFromTable(div_element, pixel_left_pos) {
    slot_start_date = div_element.parent().attr('start');
    slot_end_date = div_element.parent().attr('end');
    slot_available_days = Number(div_element.parent().attr('task_days'));
    selected_max_days = div_element.parent().attr('task_max_days');
    selected_max_days_eligible = Math.min(max_days_eligible, selected_max_days); // The smaller number of days eligible to book for the flavor
    var tootltip_id = "#tooltip_" + div_element.parent().attr('task_id');
    var today = moment.tz(time_zone).format('DD/MM/YYYY');

    percentage_of_hover = pixel_left_pos / div_element.width() * 100;
    difference_between_dates = (percentage_of_hover / 100) * slot_available_days;
    days_between_dates = Math.floor(difference_between_dates);

    selected_start = moment(slot_start_date, "DD/MM/YYYY").add(days_between_dates, 'days').format("DD/MM/YYYY");

    if(today == selected_start) {
      $(tootltip_id).find(".tooltip-date").text("NOW to " + selected_end);
    }
    else {
      $(tootltip_id).find(".tooltip-date").text(selected_start + " to " + selected_end);
    }

    if(selected_max_days_eligible <= slot_available_days) {
      // We need to minus a day as we include the current day as well
      selected_end = moment(selected_start, "DD/MM/YYYY").add(selected_max_days_eligible - 1, 'days').format("DD/MM/YYYY");
      if(moment(selected_end, "DD/MM/YYYY").isAfter(moment(slot_end_date, "DD/MM/YYYY"))) {
        selected_end = moment(slot_end_date, "DD/MM/YYYY").format("DD/MM/YYYY");
      }
    }
    else {
      selected_end = moment(slot_end_date, "DD/MM/YYYY").format("DD/MM/YYYY");
    }

    // var moment_difference = moment(selected_end, "DD/MM/YYYY").diff(moment(selected_start, "DD/MM/YYYY"), 'days');
    // selected_days = moment_difference + 1;
    setReservationTimes();
    selected_su = convertToFloat((selected_usage_rate * 24) * selected_days);

    $(tootltip_id).find(".tooltip-days").text(selected_days + " days");
  }

  /* Private function to update the selected dates with given dates */
  function updateDateRange(start, end) {
    selected_start = start.format("DD/MM/YYYY");
    selected_end = end.format("DD/MM/YYYY");
    // var moment_difference = moment(selected_end, "DD/MM/YYYY").diff(moment(selected_start, "DD/MM/YYYY"), "days");
    // selected_days = moment_difference + 1;
    setReservationTimes();
    //console.log("su_rate: " + selected_usage_rate + " selected_days: " + selected_days);
    selected_su = convertToFloat((selected_usage_rate * 24) * selected_days);
    checkEligibilty();
  }

  /* Private function to determine start and end time relative to timezones */
  function setReservationTimes() {
    var today = moment.tz(time_zone);
    var utc_now = moment.utc();
    var timezone_offset = moment.tz(time_zone).utcOffset();
    if(moment(selected_start, "DD/MM/YYYY").isSame(today, "day")) {
      // Start from now
      start_time = moment.tz(time_zone).add(3, "m").format("YYYY-MM-DD HH:mm");
      if(moment(utc_now.format("YYYY-MM-DD")).isBefore(today.format("YYYY-MM-DD"), 'day')) {
        // UTC before
        var utc_end = moment(selected_end, "DD/MM/YYYY").subtract(1, "days").format("DD/MM/YYYY");
      }
      else if(moment(utc_now.format("YYYY-MM-DD")).isAfter(today.format("YYYY-MM-DD"), 'day')) {
        // UTC after
        var utc_end = moment(selected_end, "DD/MM/YYYY").add(1, "days").format("DD/MM/YYYY");
      }
      else {
        var utc_end = selected_end;
      }
      // Add the timezone offset to make sure all reservations end at 23:59 UTC
      end_time = moment.utc(utc_end + " 23:59", "DD/MM/YYYY HH:mm").add(timezone_offset, "m").format("YYYY-MM-DD HH:mm");
    }
    else {
      // Start in future
      // Add the timezone offset to make sure all reservations start at 00:00 UTC
      start_time = moment.utc(selected_start + " 00:00", "DD/MM/YYYY HH:mm").add(timezone_offset, "m").format("YYYY-MM-DD HH:mm");
      // Add the timezone offset to make sure all reservations end at 23:59 UTC
      end_time = moment.utc(selected_end + " 23:59", "DD/MM/YYYY HH:mm").add(timezone_offset, "m").format("YYYY-MM-DD HH:mm");
    }
    var moment_difference = (moment.duration(moment(end_time).diff(moment(start_time)))).asDays();
    selected_days = +moment_difference.toFixed(2);
    // console.log("time_zone", time_zone);
    // console.log("utc_now", utc_now.format("DD/MM/YYYY"));
    // console.log("timezone_offset", timezone_offset);
    // console.log("selected_start", selected_start);
    // console.log("selected_end", selected_end);
    // console.log("start_time", start_time);
    // console.log("end_time", end_time);
    // console.log("selected_days", (selected_days));
  }


  /* Private function to display the reserve modal */
  function displayReserveModal(slot_id) {
    var slot = reservation_data.find(obj => {
      return obj.id == slot_id
    });
    $("#modal_su_budget").text(max_su);

    if(slot) {
      selected_flavor = slot.parent_id;
      selected_usage_rate = getSURate(slot.details.usage_rate);
      selected_su = convertToFloat((selected_usage_rate * 24) * selected_days);
      // selected_max_days = Math.floor(slot.details.max_duration / 24);
      // selected_max_days_eligible = Math.min(max_days_eligible, selected_max_days) - 1; // The smaller number of days eligible to book for the flavor - 1 to hover ending on last day
      // console.log("selected_usage_rate: " + selected_usage_rate);
      $("#modal_flavor_title").text(slot.title);
      $("#modal_flavor_details").html(getDetails(slot.details));
      showDateRange(slot.date_start, slot.date_end);
      $("#modal_total_days").text(selected_days + " days");
      checkEligibilty();
      $("#create_reservation_modal").modal();
    }
  }

  /* Private function to display the extend modal */
  function displayExtendModal() {
    disableReserveAction(); // Disable form button until eligibilty checks have been executed

    getFlavorData()
      .then((data) => {
        var flavor_data = data;
        // console.log(flavor_data);
        $("#modal_su_budget").text(max_su);
        if(flavor_data) {
          hideExtendError();
          selected_days = 0;
          selected_flavor = flavor_data.flavor.id;
          selected_usage_rate = flavor_data.flavor.extra_specs["nectar:rate"] ? flavor_data.flavor.extra_specs["nectar:rate"] : 0;
          selected_su = convertToFloat((selected_usage_rate * 24) * selected_days);
          selected_start = moment(flavor_data.start, "YYYY-MM-DD[T]HH:mm:ss");//.format("DD/MM/YYYY");
          selected_end = moment(flavor_data.end, "YYYY-MM-DD[T]HH:mm:ss");//.format("DD/MM/YYYY");

          // Is there a date date between the reservation end date and flavor slot start date?
          if(selected_start.isAfter(moment(current_end_datetime, "YYYY-MM-DD HH:mm").add(1, "days"))) {
            // The reservation can't be extended
            $("#id_new_end").datepicker('hide');
            showExtendError("The flavor is not available after the reservation end date so the reservation can't be extended. Please create a new reservation.");
          }
          else {
            // The flavor is available... limits will need to be checked.
            checkReservationDays();
            calculateHours();
            calculateSU();
          }
        }
      })
      .catch((error) => {
        console.error(error);
        if(error === "Data empty!") {
          $("#id_new_end").datepicker('hide');
          showExtendError("The reservation can't be extended because the flavor is not available. You will need to create a new reservation.");
        }
      });
  }

  /* Private function to convert a flavor usage rate string to a number */
  function getSURate(usage_rate_string) {
    if(usage_rate_string == "FREE") {
      return 0;
    }
    else {
      var usage_rate_arr = usage_rate_string.split(" ");
      return Number(usage_rate_arr[0]);
    }
  }

  /* Private function to disable the reserve button and hide eligibilty status */
  function disableReserveAction() {
    $("#reserve_btn").addClass("disabled");
    $("#reserve_btn").prop('disabled', true);
    $("#eligibility_status").hide();
    $("#eligibility_message").hide();
  }

  /* Private function to enable the reserve button and show eligibilty status */
  function enableReserveAction() {
    $("#eligibility_status").show();
    $("#eligibility_message").show();
    $("#reserve_btn").removeClass("disabled");
    $("#reserve_btn").prop('disabled', false);
  }

  /* Private function to check the eligibilty of the reservation input */
  function checkEligibilty() {
    disableReserveAction();
    var hours_eligible = calculateHours();
    var usage_eligible = calculateSU();

    if(hours_eligible && usage_eligible) {
      $("#eligibility_status").html("<p class='h3 text-success'><span class='fa fa-check'></span> Eligible</p>");
      if(max_su) { $("#eligibility_message").html("<strong>NOTE:</strong> this calculation does not take into account SU usage between now and the reservation start date."); }
      enableReserveAction();
    }
    else {
      if(hours_eligible === false) {
        $("#eligibility_message").html(getErrorMessage());
      }
      else if(usage_eligible === false) {
        $("#eligibility_message").html("The number of selected days exceeds your project's usage limit. If you require more, please amend your allocation.");
      }
      $("#eligibility_status").html("<p class='h3 text-danger'><span class='fa fa-times'></span> Not eligible</p>");
      $("#eligibility_status").show();
      $("#eligibility_message").show();
    }
  }

  /* Private function to determine how many days the project is eligible to extend the flavor for */
  function checkReservationDays() {
    selected_max_days_available = moment(selected_end, "YYYY-MM-DD[T]HH:mm:ss").diff(moment(current_end_date, "DD/MM/YYYY"), "days");
    var max_end_date = moment.tz(time_zone).add(selected_max_days, 'days');
    //console.log("max_end_date", max_end_date.format("DD/MM/YYYY"));
    selected_days_remaining = max_end_date.diff(moment(current_end_datetime, "YYYY-MM-DD HH:mm"), 'days');
    ///selected_max_days = max_days_from_end; // overwrite selected_max_days with new calculation from current end date
    selected_max_days_eligible = Math.min(selected_max_days_available, selected_days_remaining, max_days_eligible);
    $("#modal_extend_days").text(selected_max_days_eligible + " days");

    if(selected_max_days_eligible === 0) {
      $("#id_new_end").datepicker('hide');
      showExtendError(getErrorMessage());
    }
  }

  function daysValid() {
    //console.log("selected_days", selected_days);
    //console.log("selected_max_days_eligible", selected_max_days_eligible);
    return ((selected_max_days_eligible > 0) && (selected_max_days_eligible >= selected_days));
  }

  /* Private function to show eligibilty to reserve selected days (was previously hours) */
  function calculateHours() {
    // var selected_hours = selected_days * 24;

    // console.log(selected_days);
    // console.log(total_days_used);
    var used_percent = Math.round(total_days_used / max_days * 100);
    var pending_percent = Math.round(selected_days / max_days * 100);
    var new_total = selected_days + total_days_used;
    var new_percent = Math.ceil(new_total / max_days * 100);

    $("#modal_total_days").text(selected_days + " days");
    $("#modal_total_days_used").text(new_total);
    $("#hours_progressbar_used").css("width", (used_percent + "%"));
    $("#hours_progressbar_used").data("aria-valuenow", used_percent.toString());
    $("#hours_progressbar_pending").css("width", (pending_percent + "%"));
    $("#hours_progressbar_pending").data("aria-valuenow", pending_percent.toString());
    // $("#hours_progressbar_pending").find(".percentage-used").text(pending_percent + "%");

    // Does the project have days remaining and is total below the days limit?
    if(daysValid()) {
      $("#hours_progressbar_used").show();
      $("#hours_progressbar_pending").removeClass("progress-bar-danger");
      $("#hours_progressbar_pending").addClass("progress-bar-success");
      return true;
    }
    else {
      if(new_percent > 100) {
        $("#hours_progressbar_used").hide();
        $("#hours_progressbar_pending").css("width", ("100%"));
        $("#hours_progressbar_pending").data("aria-valuenow", "100");
        // $("#hours_progressbar_pending").find(".percentage-used").text(new_percent + "%");
        $("#hours_progressbar_pending").removeClass("progress-bar-success");
        $("#hours_progressbar_pending").addClass("progress-bar-danger");
      }
      else {
        $("#hours_progressbar_used").show();
        $("#hours_progressbar_pending").removeClass("progress-bar-danger");
        $("#hours_progressbar_pending").addClass("progress-bar-success");
      }
      return false;
    }
  }

  /* Private function to show eligibilty to reserve the total service units for selected days */
  function calculateSU() {
    // var selected_hours = selected_days * 24;
    if(!selected_usage_rate || max_su === -1) {
      hideSUCalculator();
      return true;
    }

    $("#usage_eligibilty").show();

    var used_percent = Math.round(total_su_used / max_su * 100);
    var pending_percent = Math.round(selected_su / max_su * 100);
    var new_total = Math.round(selected_su + total_su_used);
    var new_percent = Math.ceil(new_total / max_su * 100);

    $("#modal_total_su").text(selected_su + " Service Units");
    $("#modal_total_su_used").text(new_total);
    // console.log("new_percent: " + new_percent);
    $("#usage_progressbar_used").css("width", (used_percent + "%"));
    $("#usage_progressbar_used").data("aria-valuenow", used_percent.toString());
    // $("#usage_progressbar_used").find(".percentage-used").text(used_percent + "%");
    $("#usage_progressbar_pending").css("width", (pending_percent + "%"));
    $("#usage_progressbar_pending").data("aria-valuenow", pending_percent.toString());
    // $("#usage_progressbar_pending").find(".percentage-used").text(pending_percent + "%");

    if(new_percent <= 100) {
      $("#usage_progressbar_used").show();
      $("#usage_progressbar_pending").removeClass("progress-bar-danger");
      $("#usage_progressbar_pending").addClass("progress-bar-success");
      return true;
    }
    else {
      $("#usage_progressbar_used").hide();
      $("#usage_progressbar_pending").css("width", ("100%"));
      $("#usage_progressbar_pending").data("aria-valuenow", "100");
      // $("#usage_progressbar_pending").find(".percentage-used").text(new_percent + "%");
      $("#usage_progressbar_pending").removeClass("progress-bar-success");
      $("#usage_progressbar_pending").addClass("progress-bar-danger");
      return false;
    }
  }

  function hideSUCalculator() {
    $("#usage_eligibilty").hide();
  }

  function hideExtendError() {
    $("#extend_error").hide();
    $("#extend_form").show();
  }

  function showExtendError(e_message) {
    $("#extend_form").hide();
    $("#extend_error").text(e_message);
    $("#extend_error").show();
  }

  function getErrorMessage() {
    var error_message = "";
    if(max_days_eligible === 0) {
      error_message = "The reservation can't be extended because the project is out of reservation quota.";
    }
    else if(selected_days_remaining === 0) {
      error_message = "You have reserved this flavor for " + selected_max_days + " days from today which is the limit it can be reserved for. You cannot extend further at this time.";
    }
    else if(selected_max_days_available === 0) {
      error_message = "The reservation can't be extended because the flavor is not available. You will need to create a new reservation.";
    }
    else {
      error_message = "This flavor can only be reserved for " + selected_max_days_eligible + " days.";
    }
    return error_message;
  }

  /* Private function to get the project usage to date from api request */
  function getUsageTotal() {
    $.ajax({
      url: "/api/nectar/allocation/usage/",
      type: 'GET',
      async: false,
      success: function(data) {
        // console.log(data);
        if(data[0].rate) {
          // console.log("Got used! " + data[0].rate);
          total_su_used = convertToFloat(data[0].rate);
          $("#su_used").text(total_su_used);
          $("#modal_total_su_used").text(total_days_used);
          return true;
        }
        return false;
      },
      error: function (xhr, ajaxOptions, thrownError) {
        console.error(url + " " + xhr.status + " " + thrownError);
        return false;
      }
    });
  }

  /* Private function to get the project usage budget from api request */
  function getUsageBudget() {
    $.ajax({
      url: "/api/nectar/allocation/quota/rating.budget/",
      type: 'GET',
      async: false,
      success: function(data) {
        if(data) {
          // console.log("Got budget! " + data);
          max_su = data;
          if(max_su === -1) {
            $("#su_budget").text("Unlimited");
          }
          else {
            $("#su_budget").text(max_su);
          }
          return true;
        }
        return false;
      },
      error: function (xhr, ajaxOptions, thrownError){
        console.error(url + " " + xhr.status + " " + thrownError);
        return false;
      }
    });
  }

  /* Private function to set usage eligible */
  // function setUsageEligible() {
  //   if(max_su && total_su_used) {
  //     max_su_eligible = max_su - total_su_used;
  //   }
  //   // console.log("SU remaining: " + max_su_eligible);
  // }

  /* Public function to set reservation limits */
  reservations.setTimezone = function(tz) {
    time_zone = tz;
    moment.tz.setDefault(time_zone);
  }

  /* Public function to set reservation limits */
  reservations.setReservationLimits = function(project_max_days = 0, project_days_used = 0, project_max_reservations = 0, project_reservations_used = 0) {
    max_days = project_max_days;
    total_days_used = project_days_used;
    max_days_eligible = Math.floor(max_days - total_days_used)

    max_reservations = project_max_reservations;
    total_reservations_used = project_reservations_used;
    max_reservations_eligible = max_reservations - total_reservations_used;
    // console.log("Days remaining: " + max_days_eligible);
  }

  /* Public function to get reservations */
  reservations.showSlots = function() {
    category = $("input[type='radio'][name='flavor_category']:checked").val();
    availabilty_zone = $("#availabilty_zone option:selected").val();
    if(max_days_eligible && max_reservations_eligible) {
      displayReservationsTable();
    }
    else {
      $(".reservations-error").text("You can't create a reservation because your project limits have been reached.");
      $(".reservations-error").removeClass("alert-warning").addClass("alert-danger");
    }
  }

  /* Public function to submit the create reservation form */
  reservations.createReservation = function() {
    var form_id = "#reserve_form";
    setReservationTimes();
    $(form_id + " input[name='start']").val(start_time);
    $(form_id + " input[name='end']").val(end_time);
    $(form_id + " input[name='flavor']").val(selected_flavor);
    
    $(form_id).submit();
  }

  /* Public function to submit the create reservation form */
  reservations.extendReservation = function() {
    var submit_end_val = $('#id_new_end').val();
    var submit_end_date = moment(submit_end_val, "DD/MM/YYYY").format("YYYY-MM-DD") + " 23:59";
    //console.log(submit_end_date);
    $('#id_new_end').val(submit_end_date);
    // console.log(submit_end_date);
    var extend_form = $("#id_new_end").closest("form");
    if(extend_form) { extend_form.submit(); }
  }

  /* Public function check if project has usage total and budget to display */
  reservations.getUsageData = function() {
    let usage_total = getUsageTotal();
    let usage_budget = getUsageBudget();
    if(usage_total && usage_budget) {
      calculateSU();
    }
  }

  reservations.showReservation = function() {
    selected_flavor = $("#reservation_flavor").val();
    selected_max_days = Math.floor(hoursToDays($("#reservation_flavor_max_hours").val()));
    var current_end_str = $("#current_end").val();
    current_end_datetime = moment(current_end_str, "YYYY-MM-DD[T]HH:mm:ss").format("YYYY-MM-DD HH:mm");
    current_end_date = moment(current_end_str, "YYYY-MM-DD[T]HH:mm:ss").format("DD/MM/YYYY");

    selected_su = convertToFloat((selected_usage_rate * 24) * selected_days);
    var modal_start_date = moment(current_end_date, "DD/MM/YYYY").add(1, "days").format("DD/MM/YYYY");

    $("#id_new_end").datepicker({
      format: "dd/mm/yyyy",
      startDate: modal_start_date,
      autoclose: true
    });

    displayExtendModal();
    $("#id_new_end").datepicker("show");

    $('#id_new_end').on('changeDate', function() {
      var new_end_date = $('#id_new_end').datepicker('getFormattedDate');
      updateDateRange(moment(modal_start_date, "DD/MM/YYYY"), moment(new_end_date, "DD/MM/YYYY"));
    });

  }

  // Return public functions
  return reservations;
}());
