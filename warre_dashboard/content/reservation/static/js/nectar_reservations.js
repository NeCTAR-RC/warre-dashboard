var reservationAvailabilty = (function() {

  var reservationSlots = {};
  var reservation_data = {};
  // var reservations_table = {};
  var category = "";
  var availabilty_zone = "";
  // var max_hours;
  // var total_hours_used;
  var max_reservations;
  var total_reservations_used;
  var selected_usage_rate = 0;
  var max_days = 0;
  var total_days_used = 0;
  var max_su = 0;
  var total_su_used = 0;
  var selected_start;
  var selected_end;
  var selected_days;
  var selected_su;
  var selected_flavor;
  var selected_max_days;
  var max_days_eligible;
  // var max_su_eligible = 0;

  /* Private function to convert string to number with 2 decimal places */
  function convertToFloat(str_num) {
    return Math.round(Number(str_num) * 100) / 100;
  }
  /* Private function to get reservation schedule data */
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
          category: item.flavor.category,
          description: item.flavor.description,
          availability_zone: item.flavor.availability_zone,
          size: (item.flavor.vcpu + "VCPUs " + item.flavor.memory_mb + "MB RAM"),
          max_length_hours: item.flavor.max_length_hours,
          usage_rate: item.flavor.extra_specs["nectar:rate"] ? (item.flavor.extra_specs["nectar:rate"] + " SU/day") : "FREE",
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
        console.log(data);
        reservation_data = formatSlotData(data);
        console.log(reservation_data);
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
            console.log('Clicked!', taskId, taskName, taskCountDays);
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

  /* Private function to get details of a time slot and return as html formatted string */
  function getDetails(details) {

    var details_string = "<p>";

    $.each( details, function( key, value ) {
      label = key.split('_').join(' ');
      details_string += ("<strong class='text-capitalize'>" + label + ":</strong> " + value + "<br />");
    });

    details_string += "</p>";

    return details_string;
  }

  function showDateRange(slotStart, slotEnd) {
    //maxEndDate = 
    $('input[name="daterange"]').daterangepicker({
      opens: 'left',
      startDate: selected_start,
      endDate: selected_end,
      minDate: slotStart,
      maxDate: slotEnd,
      locale: {
        format: 'DD/MM/YYYY'
      }
    }, function(begin, end, label) {
      updateDateRange(begin, end);
      console.log("A new date selection was made: " + begin.format('DD/MM/YYYY') + ' to ' + end.format('DD/MM/YYYY'));
    });
  }

  function activateSlotMouseover() {

    if(max_days_eligible) {
      $(".div-task").each(function() {
        selected_max_days = Math.floor(Number($(this).parent().attr('task_max_hours')) / 24);
        var hover_size = Math.min(max_days_eligible, selected_max_days); // The smaller number of days eligible to book for the flavor
        var slot_available_days = Number($(this).parent().attr('task_days'));
        if(hover_size < slot_available_days) {
          let slot_hover = $(this).find('.show-hover');
          let hover_width_percent = hover_size / slot_available_days * 100;
          //console.log(hover_width_percent);
          slot_hover.css('width', hover_width_percent + "%");
        }
        //console.log(hover_size);
      });
    } 

    $(".div-task").mousemove(function(e) {
      var relX = e.pageX - $(this).offset().left;
      // var div_width = $(this).width();
      // var slot_available_days = Number($(this).parent().attr('task_days'));
      // var day_width = div_width / slot_available_days;
      // if(relX )
      $(this).find(".show-hover").css({'left': relX});
      getDatesFromTable($(this), relX);
    });
  }

  function updateDateRange(start, end) {
    selected_start = start;
    selected_end = end;
    moment_start = moment(start);
    moment_end = moment(end);
    selected_days = moment_end.diff(moment_start, 'days');
    console.log("su_rate: " + selected_usage_rate + " selected_days: " + selected_days);
    selected_su = convertToFloat(selected_usage_rate * selected_days);
    checkEligibilty();
  }

  /* Private function to update the date range displayed in the tooltip and modal */
  function getDatesFromTable(div_element, pixel_left_pos) {
    slot_start_date = div_element.parent().attr('start');
    slot_end_date = div_element.parent().attr('end');
    slot_available_days = Number(div_element.parent().attr('task_days'));
    selected_max_days = Math.floor(Number(div_element.parent().attr('task_max_hours')) / 24);
    var slot_length = Math.min(max_days_eligible, selected_max_days); // The smaller number of days eligible to book for the flavor
    var tootltip_id = "#tooltip_" + div_element.parent().attr('task_id');

    percentage_of_hover = pixel_left_pos / div_element.width() * 100;
    difference_between_dates = (percentage_of_hover / 100) * slot_available_days;
    days_between_dates = Math.floor(difference_between_dates);
    // // console.log("differenceBetweenDates: " + differenceBetweenDates + " daysBetweenDates: " + daysBetweenDates);
    selected_start = moment(slot_start_date, "DD/MM/YYYY").add(days_between_dates, 'days').format("DD/MM/YYYY");

    if(slot_length < slot_available_days) {
      selected_end = moment(selected_start, "DD/MM/YYYY").add(slot_length, 'days').format("DD/MM/YYYY");
    }
    else {
      selected_end = slot_end_date;
    }
    var duration = moment.duration(moment(selected_end, "DD/MM/YYYY").diff(moment(selected_start, "DD/MM/YYYY")));
    selected_days = duration.asDays();
    // selected_days = slot_available_days - days_between_dates;
    selected_su = convertToFloat(selected_usage_rate * selected_days);
    //days_between_dates =
    // console.log("max_days_eligible: " + max_days_eligible + " slotAvailableDays: " + slotAvailableDays);
    // console.log(selected_start + " to " + selected_end);
    $(tootltip_id).find(".tooltip-date").text(selected_start + " to " + selected_end);
    $(tootltip_id).find(".tooltip-days").text(selected_days + " days");
  }

  /* Private function to display the reserve modal */
  function displayReserveModal(slot_id) {
    var slot = reservation_data.find(obj => {
      return obj.id == slot_id
    });
    
    if(slot) {
      selected_flavor = slot.parent_id;
      selected_usage_rate = getSURate(slot.details.usage_rate);
      selected_su = convertToFloat(selected_usage_rate * selected_days);
      // console.log("selected_usage_rate: " + selected_usage_rate);
      $("#modal_flavor_title").text(slot.title);
      $("#modal_flavor_details").html(getDetails(slot.details));
      showDateRange(selected_start, selected_end);
      $("#modal_total_days").text(selected_days + " days");
      checkEligibilty();
      $("#create_reservation_modal").modal();
    }
  }

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
    $("#eligibility_status").hide();
    $("#eligibility_message").hide();
    var hours_eligible = calculateHours();
    var usage_eligible = calculateSU();
    
    if(hours_eligible && usage_eligible) {
      $("#eligibility_status").html("<p class='h3 text-success'><span class='fa fa-check'></span> Eligible</p>");
      $("#eligibility_message").html("<strong>NOTE:</strong> this calculation does not take into account SU usage between now and the reservation start date.");
      $("#eligibility_status").show();
      $("#eligibility_message").show();
      $("#reserve_btn").removeClass("disabled");
    }
    else {
      if(hours_eligible === false) {
        $("#eligibility_message").html("The number of selected days exceeds your project's reservation limit. If you require more please amend your allocation.");
      }
      else if(usage_eligible === false) {
        $("#eligibility_message").html("The number of selected days exceeds your project's usage limit. If you require more please amend your allocation.");
      }
      $("#eligibility_status").html("<p class='h3 text-danger'><span class='fa fa-times'></span> Not eligible</p>");
      
      $("#eligibility_status").show();
      $("#eligibility_message").show();
    }
  }

  function calculateHours() {
    // var selected_hours = selected_days * 24;

    // console.log(selected_days);
    // console.log(total_days_used);
    var new_total = selected_days + total_days_used;
    var new_percent = Math.round(new_total / max_days * 100);

    $("#modal_total_days").text(selected_days + " days");
    $("#modal_total_days_used").text(new_total);
    $("#hours_progressbar").css("width", (new_percent + "%"));
    $("#hours_progressbar").find(".percentage-used").text(new_percent + "%");
    
    if(new_percent <= 100) {
      $("#hours_progressbar").removeClass("progress-bar-danger");
      $("#hours_progressbar").addClass("progress-bar-success");
      return true;
    }
    else {
      $("#hours_progressbar").removeClass("progress-bar-success");
      $("#hours_progressbar").addClass("progress-bar-danger");
      return false; 
    }
  }

  function calculateSU() {
    // var selected_hours = selected_days * 24;
    if(!selected_usage_rate) {
      $("#usage_eligibilty").hide();
      return true;
    }
    else if(!max_su) {
      console.error("The project does not have a usage budget.")
      return false;
    }

    $("#usage_eligibilty").show();

    var new_total = Math.round(selected_su + total_su_used);
    var new_percent = Math.round(new_total / max_su * 100);
    // max_su = Number($("#modal_su_budget").text());
    // console.log("new_total: " + new_total);
    // console.log("max_su: " + max_su);

    // console.log(selected_su);
    $("#modal_total_su").text(selected_su + " Service Units");
    $("#modal_total_su_used").text(new_total);
    // console.log("new_percent: " + new_percent);
    $("#usage_progressbar").css("width", (new_percent + "%"));
    $("#usage_progressbar").find(".percentage-used").text(new_percent + "%");
    
    if(new_percent <= 100) {
      $("#usage_progressbar").removeClass("progress-bar-danger");
      $("#usage_progressbar").addClass("progress-bar-success");
      return true;
    }
    else {
      $("#usage_progressbar").removeClass("progress-bar-success");
      $("#usage_progressbar").addClass("progress-bar-danger");
      return false; 
    }
    
  }

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
      error: function(error) {
        console.log(error);
        return false;
      }
    });
  }

  function getUsageBudget() {
    $.ajax({
      url: "/api/nectar/allocation/quota/rating.budget/",
      type: 'GET',
      async: false,
      success: function(data) {
        // console.log(data);
        if(data) {
          console.log("Got budget! " + data);
          max_su = data;
          // max_su = 5000;
          $("#su_budget").text(max_su);
          $("#modal_su_budget").text(max_su);
          return true;
        }
        return false;
      },
      error: function(error) {
        console.log(error);
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
  reservationSlots.setReservationLimits = function(project_max_days = 0, project_days_used = 0, project_max_reservations = 0, project_reservations_used = 0) {
    // max_hours = project_max_hours;
    max_days = project_max_days;
    total_days_used = project_days_used;
    // total_hours_used = project_hours_used;
    max_reservations = project_max_reservations;
    total_reservations_used = project_reservations_used;

    // max_days = Math.floor(max_hours / 24);
    // total_days_used = Math.floor(max_hours - total_hours_used / 24);
    max_days_eligible = max_days - total_days_used;
    // console.log("Days remaining: " + max_days_eligible);
  }

  /* Public function to get reservations */
  reservationSlots.showSlots = function() {
    category = $("input[type='radio'][name='flavor_category']:checked").val();
    availabilty_zone = $("#availabilty_zone option:selected").val();
    displayReservationsTable();
  }

  reservationSlots.createReservation = function() {
    // console.log(window.location.href);
    // $.post(window.location.href, {start: selected_start, end: selected_end, flavor: selected_flavor}, function(data) {
    //   console.log('Reservation Created. Server says: ' + data);
    // }).fail(function(error) {
    //   console.log(error);
    // });
    var form_id = "#reserve_form";
    //$(form_id).attr('action', window.location.href);
    var start_time = moment(selected_start, 'DD/MM/YYYY').format('YYYY-MM-DD') + " 00:00";
    var end_time = moment(selected_end, 'DD/MM/YYYY').format('YYYY-MM-DD') + " 23:59";
    $(form_id + " input[name='start']").val(start_time);
    $(form_id + " input[name='end']").val(end_time);
    $(form_id + " input[name='flavor']").val(selected_flavor);
    $(form_id).submit();
    // $(form_id).submit(function(e) {
    //   e.preventDefault()
    // });

    // $.ajax({
    //   url: window.location.href,
    //   type: 'POST',
    //   data: {start: moment(selected_start).format('YYYY-MM-DD'), end: moment(selected_end).format('YYYY-MM-DD'), flavor: selected_flavor},
    //   success: function(result) {
    //     console.log(result);
    //   },
    //   error: function(error) {
    //     console.log(error);
    //   }
    // });
  }

  reservationSlots.getUsageData = function() {
    let usage_total = getUsageTotal();
    let usage_budget = getUsageBudget();
    if(usage_total && usage_budget) {
      calculateSU();
    }
  }

  // Return public functions
  return reservationSlots;
}());