<?php php_track_vars?>
<?php
  /**************************************************************************\
  * phpGroupWare - Calendar                                                  *
  * http://www.phpgroupware.org                                              *
  * Based on Webcalendar by Craig Knudsen <cknudsen@radix.net>               *
  *          http://www.radix.net/~cknudsen                                  *
  * --------------------------------------------                             *
  *  This program is free software; you can redistribute it and/or modify it *
  *  under the terms of the GNU General Public License as published by the   *
  *  Free Software Foundation; either version 2 of the License, or (at your  *
  *  option) any later version.                                              *
  \**************************************************************************/

  /* $Id$ */

  $phpgw_flags["currentapp"] = "calendar";
  include("../header.inc.php");

  function grab_group($db,$id)
  {
    $db->query("select groups from webcal_entry_groups where cal_id='$id'");
    $db->next_record();

    return $db->f("groups");
  }

  if ($year) $thisyear = $year;
  if ($month) $thismonth = $month;

  $pri[1] = lang_common("Low");
  $pri[2] = lang_common("Medium");
  $pri[3] = lang_common("High");

  $unapproved = FALSE;

  if ($id < 1) {
     echo lang_calendar("Invalid entry id.");
     exit;
  }

  // first see who has access to view this entry
  $is_my_event = false;
  $phpgw->db->query("SELECT cal_id FROM webcal_entry_user WHERE cal_login='"
	      . "$loginid' AND cal_id = $id");

  $phpgw->db->next_record();
  if ($phpgw->db->f(0) == $id)
     $is_my_event = true;

  $phpgw->db->query("SELECT cal_create_by, cal_date, cal_time, cal_mod_date, "
	      . "cal_mod_time,cal_duration,cal_priority,cal_type,cal_access, "
	      . "cal_name,cal_description FROM webcal_entry WHERE cal_id=$id");

  $phpgw->db->next_record();

  $create_by	= $phpgw->db->f(0);
  $name 	= $phpgw->db->f(9);
  $description 	= $phpgw->db->f(10);

  $description = htmlspecialchars($description);
  $description = nl2br($description);

?>
<h2>
 <font color="<?php echo $H2COLOR; ?>">
  <?php echo htmlspecialchars($name); ?>
 </font>
</h2>

<TABLE BORDER=0>
<?php
  // Some browser add a \n when its entered in the database. Not a big deal
  // this will be printed even though its not needed.
  if ($description) {
     echo "<tr><td VALIGN=\"top\"><b>" . lang_calendar("Description") . ":</B></TD><td>"
	. "$description</TD></TR>";
  }

?>

<tr>
  <TD VALIGN="top"><b><?php echo lang_common("Date"); ?>:</B></TD>
  <td><?php echo date_to_str($phpgw->db->f(1)); ?></TD>
</TR>

<?php
  // save date so the trailer links are for the same time period
  $list		= split("-",$phpgw->db->f(1));
  $thisyear	= (int)($phpgw->db->f(1) / 10000);
  $thismonth	= ($phpgw->db->f(1) / 100) % 100;
  $thisday 	= $phpgw->db->f(1) % 100;

  if ($phpgw->db->f(2) > 0) { 
     ?>
      <tr>
       <TD VALIGN="top"><b><?php echo lang_common("Time"); ?>:</B></TD>
       <td><?php echo display_time($phpgw->db->f(2)); ?></TD>
      </TR>
     <?php 
  }

  if ($phpgw->db->f(5) > 0) {
     echo "<tr><TD VALIGN=\"top\"><b>" . lang_calendar("Duration") . ":</B></TD><td>"
	. $phpgw->db->f(5) . " " . lang_calendar("minutes") . "</TD></TR>";
  }
?>

<tr>
  <TD VALIGN="top"><b><?php echo lang_common("Priority"); ?>:</B></TD>
  <td><?php echo $pri[$phpgw->db->f(6)]; ?></TD>
</TR>

<?php
  echo "<tr><TD VALIGN=\"top\"><b>" . lang_common("Created by") . ":</B></TD>\n";

  echo "<td>" . $phpgw_info["user"]["fullname"] . "</td></tr>\n";
?>
<tr>
  <TD VALIGN="top"><b><?php echo lang_common("Updated"); ?>:</B></TD>
  <td><?php echo date_to_str($phpgw->db->f(3)) . " " . display_time($phpgw->db->f(4));
      ?></TD>
</TR>

<?php
  $cal_groups_temp = $phpgw->accounts->read_group_names($id);
  for($i = 0; $i < count($cal_groups_temp); $i++) {
    $cal_groups .= $cal_groups_temp[$i][1] . "<br>\n";
  }
  if ($cal_groups)
     echo "<tr><td><b>" . lang_common("Groups") . ":</b></td><td>".$cal_groups."</td></tr>";
?>

<tr>
  <TD VALIGN="top"><b><?php echo lang_calendar("Participants"); ?>:</B></TD>
  <td><?php

    $phpgw->db->query("SELECT webcal_entry_user.cal_login, accounts.lastname, "
		. "accounts.firstname, webcal_entry_user.cal_status "
		. "FROM webcal_entry_user, accounts WHERE webcal_entry_user."
		. "cal_id='$id' AND webcal_entry_user.cal_login = accounts."
		. "loginid");

    $first = 1;
    while ($phpgw->db->next_record()) {
      if ($first)
         $first = 0;
      else
         echo "<BR>";
      if (strlen($phpgw->db->f(1)) > 0)
         echo $phpgw->db->f(1) . ", " . $phpgw->db->f(2);
      else
         echo $phpgw->db->f(0);
    }
?>
  </TD>
</TR>
<tr>
  <TD VALIGN="top"><b><?php echo lang_calendar("Repetition"); ?>:</B></TD>
  <td>
   <?php
     $phpgw->db->query("SELECT * from webcal_entry_repeats WHERE cal_id=$id");
     $phpgw->db->next_record();
     if (substr($phpgw->db->f(5),0,1) == 'y')
	$t_repeat_days = lang_common("Sunday ");
     if (substr($phpgw->db->f(5),1,1) == 'y')
	$t_repeat_days .= lang_common("Monday ");
     if (substr($phpgw->db->f(5),2,1) == 'y')
	$t_repeat_days .= lang_common("Tuesday ");
     if (substr($phpgw->db->f(5),3,1) == 'y')
 	$t_repeat_days .= lang_common("Wednesday ");
     if (substr($phpgw->db->f(5),4,1) == 'y')
	$t_repeat_days .= lang_common("Thursday ");
     if (substr($phpgw->db->f(5),5,1) == 'y')
	$t_repeat_days .= lang_common("Friday ");
     if (substr($phpgw->db->f(5),6,1) == 'y')
	$t_repeat_days .= lang_common("Saturday ");
	   
     echo $phpgw->db->f(2) . " (";
     if ($phpgw->db->f(3))
	echo "ends: " . $phpgw->db->f(3) . ", ";
	if ($phpgw->db->f(2) == 'weekly')
	   echo lang_calendar("days repeated") . ": " . $t_repeat_days . ", ";

	echo lang_calendar("frequency") . ": " . $phpgw->db->f(4) . ")";
		
   ?>

</TABLE>

<P>

<?php
  if ($phpgw->session->loginid == $create_by) {
     echo "<A HREF=\"edit_entry.php?sessionid=" . $phpgw->session->id . "&id=$id\">"
	. lang_common("Edit") . "</A><BR>\n<A HREF=\"delete.php?sessionid="
	. $phpgw->session->id . "&id=$id\" onClick=\"return confirm('"
	. lang_calendar("Are you sure\\nyou want to\\ndelete this entry ?\\n\\nThis will delete\\nthis entry for all users.") . "');\">" . lang_common("Delete") . "</A><BR>\n";
  }
?>

<?php
  include($phpgw_info["server"]["api_dir"] . "/footer.inc.php");
?>

