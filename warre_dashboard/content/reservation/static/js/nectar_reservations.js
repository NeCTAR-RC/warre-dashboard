/**
  * Nectar Reservations
  * Author: Darcelle Malby (d.malby@uq.edu.au)
  * Company: Australian Research Data Commons
  * Website: https://ardc.edu.au
  * Copyright: © 2021 ARDC Nectar Research Cloud
  **/

var reservationAvailabilty = (function() {

  var reservations = {};
  var reservation_data = {};
  var category = "";
  var availabilty_zone = "";
  // var max_hours;
  // var total_hours_used;
  var max_days = 0;
  var total_days_used = 0;
  var max_days_eligible = 0;
  var max_reservations;
  var total_reservations_used;
  var max_reservations_eligible;
  var max_su = 0;
  var total_su_used = 0;
  var selected_start;
  var selected_end;
  var selected_days;
  var selected_su;
  var selected_flavor;
  var selected_max_days;
  var selected_max_days_eligible;
  var selected_usage_rate = 0;
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
    const data_start = moment().add(1, 'days').format('YYYY-MM-DD');
    const data_end = moment().add(3, 'months').format('YYYY-MM-DD');

    var api_url = "/api/warre/flavor-slots/?category=" + category + "&availability_zone=" + availabilty_zone + "&start=" + data_start + "&end=" + data_end;

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

  /* Private function to format the data to display correctly in the table */
  function formatSlotData(object_data) {

    let new_format = [];
    let index = 1;

    object_data.forEach(item => {
      var time_slot = {
        id: index,
        parent_id: item.flavor.id,
        title: item.flavor.name,
        name: item.flavor.name,
        date_start: moment(item.start).format('DD/MM/YYYY'),
        date_end: moment(item.end).format('DD/MM/YYYY'),
        color: '#81d033',
        details: {
          class: item.flavor.category,
          description: item.flavor.description,
          availability_zone: item.flavor.availability_zone,
          size: (item.flavor.vcpu + "VCPUs " + item.flavor.memory_mb + "MB RAM"),
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

    return new_format;
  }

  /* Private function to render the reservations table */
  function displayReservationsTable() {
    getReservationsData()
      .then((data) => {
        // console.log(data);
        reservation_data = formatSlotData(data);
        // console.log(reservation_data);
        $(".reservations-error").hide();
        $('#reservations_table').show();

        $('#reservations_table').gantt({
          dtStart: moment().format('DD/MM/YYYY'),
          dtEnd: moment().add(3, 'months').format('DD/MM/YYYY'),
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
        console.log(error);
        if(error === "Data empty!") {
          $('#reservations_table').hide();
          $(".reservations-error").show();
        }
      });
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
        "days": selected_max_days_eligible
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
      if(hover_size < slot_available_days) {
        let slot_hover = $(this).find('.show-hover');
        let hover_width_percent = hover_size / slot_available_days * 100;
        slot_hover.css('width', hover_width_percent + "%");
      }
    });
    // Create mousemove event for each time slot div
    $(".div-task").mousemove(function(e) {
      var rel_x = e.pageX - $(this).offset().left;
      showHover($(this), rel_x); // Show hover block on start date of the mouse location
      getDatesFromTable($(this), rel_x); // Get the time slot hover dates to update tooltip and modal
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
    selected_max_days_eligible = Math.min(max_days_eligible, selected_max_days) - 1; // The smaller number of days eligible to book for the flavor - 1 to hover ending on last day
    var tootltip_id = "#tooltip_" + div_element.parent().attr('task_id');

    percentage_of_hover = pixel_left_pos / div_element.width() * 100;
    difference_between_dates = (percentage_of_hover / 100) * slot_available_days;
    days_between_dates = Math.floor(difference_between_dates);
    
    selected_start = moment(slot_start_date, "DD/MM/YYYY").add(days_between_dates, 'days').format("DD/MM/YYYY");
    
    if(selected_max_days_eligible <= slot_available_days) {
      selected_end = moment(selected_start, "DD/MM/YYYY").add(selected_max_days_eligible, 'days').format("DD/MM/YYYY");
      if(moment(selected_end, "DD/MM/YYYY").isAfter(moment(slot_end_date, "DD/MM/YYYY"))) {
        selected_end = moment(slot_end_date, "DD/MM/YYYY").format("DD/MM/YYYY");
      }
    }
    else {
      selected_end = moment(slot_end_date, "DD/MM/YYYY").format("DD/MM/YYYY");
    }
    
    var moment_difference = moment(selected_end, "DD/MM/YYYY").diff(moment(selected_start, "DD/MM/YYYY"), 'days');
    selected_days = moment_difference + 1; // to include end date in the duration
    selected_su = convertToFloat((selected_usage_rate * 24) * selected_days);

    $(tootltip_id).find(".tooltip-date").text(selected_start + " to " + selected_end);
    $(tootltip_id).find(".tooltip-days").text(selected_days + " days");
  }

  /* Private function to update the selected dates with given dates */
  function updateDateRange(start, end) {
    selected_start = start.format("DD/MM/YYYY");
    selected_end = end.format("DD/MM/YYYY");
    var moment_difference = moment(selected_end, "DD/MM/YYYY").diff(moment(selected_start, "DD/MM/YYYY"), "days");
    selected_days = moment_difference + 1; // to include end date in the duration
    console.log("su_rate: " + selected_usage_rate + " selected_days: " + selected_days);
    selected_su = convertToFloat((selected_usage_rate * 24) * selected_days);
    checkEligibilty();
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

  /* Private function to check the eligibilty of the reservation input */
  function checkEligibilty() {
    $("#reserve_btn").addClass("disabled");
    $("#reserve_btn").prop('disabled', true);
    $("#eligibility_status").hide();
    $("#eligibility_message").hide();
    var hours_eligible = calculateHours();
    var usage_eligible = calculateSU();
    
    if(hours_eligible && usage_eligible) {
      $("#eligibility_status").html("<p class='h3 text-success'><span class='fa fa-check'></span> Eligible</p>");
      if(max_su) { $("#eligibility_message").html("<strong>NOTE:</strong> this calculation does not take into account SU usage between now and the reservation start date."); }
      $("#eligibility_status").show();
      $("#eligibility_message").show();
      $("#reserve_btn").removeClass("disabled");
      $("#reserve_btn").prop('disabled', false);
    }
    else {
      if(hours_eligible === false) {
        $("#eligibility_message").html("The number of selected days exceeds your project's reservation limit. If you require more, please amend your allocation.");
      }
      else if(usage_eligible === false) {
        $("#eligibility_message").html("The number of selected days exceeds your project's usage limit. If you require more, please amend your allocation.");
      }
      $("#eligibility_status").html("<p class='h3 text-danger'><span class='fa fa-times'></span> Not eligible</p>");
      
      $("#eligibility_status").show();
      $("#eligibility_message").show();
    }
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
    if(max_days_eligible && new_percent <= 100) {
      $("#hours_progressbar_used").show();
      $("#hours_progressbar_pending").removeClass("progress-bar-danger");
      $("#hours_progressbar_pending").addClass("progress-bar-success");
      return true;
    }
    else {
      $("#hours_progressbar_used").hide();
      $("#hours_progressbar_pending").css("width", ("100%"));
      $("#hours_progressbar_pending").data("aria-valuenow", "100");
      // $("#hours_progressbar_pending").find(".percentage-used").text(new_percent + "%");
      $("#hours_progressbar_pending").removeClass("progress-bar-success");
      $("#hours_progressbar_pending").addClass("progress-bar-danger");
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
  reservations.setReservationLimits = function(project_max_days = 0, project_days_used = 0, project_max_reservations = 0, project_reservations_used = 0) {
    max_days = project_max_days;
    total_days_used = project_days_used;
    max_days_eligible = max_days - total_days_used;

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
    var start_time = moment(selected_start, 'DD/MM/YYYY').format('YYYY-MM-DD') + " 00:00";
    var end_time = moment(selected_end, 'DD/MM/YYYY').format('YYYY-MM-DD') + " 23:59";
    $(form_id + " input[name='start']").val(start_time);
    $(form_id + " input[name='end']").val(end_time);
    $(form_id + " input[name='flavor']").val(selected_flavor);
    $(form_id).submit();
  }

  /* Public function check if project has usage total and budget to display */
  reservations.getUsageData = function() {
    let usage_total = getUsageTotal();
    let usage_budget = getUsageBudget();
    if(usage_total && usage_budget) {
      calculateSU();
    }
  }

  // Return public functions
  return reservations;
}());