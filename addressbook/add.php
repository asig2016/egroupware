<?php
  /**************************************************************************\
  * phpGroupWare - addressbook                                               *
  * http://www.phpgroupware.org                                              *
  * Written by Joseph Engo <jengo@phpgroupware.org>                          *
  * --------------------------------------------                             *
  *  This program is free software; you can redistribute it and/or modify it *
  *  under the terms of the GNU General Public License as published by the   *
  *  Free Software Foundation; either version 2 of the License, or (at your  *
  *  option) any later version.                                              *
  \**************************************************************************/

  /* $Id$ */

  if ($submit || $AddVcard) {
     $phpgw_info["flags"] = array("noheader" => True, "nonavbar" => True);
  }

  $phpgw_info["flags"]["currentapp"] = "addressbook";
  $phpgw_info["flags"]["enable_addressbook_class"] = True;
  include("../header.inc.php");
  
  $t = new Template($phpgw_info["server"]["app_tpl"]);
  $t->set_file(array( "add"	=> "add.tpl"));

  if ($AddVcard){
       Header("Location: " . $phpgw->link($phpgw_info["server"]["webserver_url"] .
              "/addressbook/vcardin.php"));
  }
  else if ($add_email) {
     list($fields["firstname"],$fields["lastname"]) = explode(" ", $name);
     $fields["email"] = $add_email;
     form("","add.php","Add",$fields);
  } else if (! $submit && ! $add_email) {
     form("","add.php","Add","","","");
  } else {
     if (! $bday_month && ! $bday_day && ! $bday_year) {
        $bday = "";
     } else {
        $bday = "$bday_month/$bday_day/$bday_year";
     }

     if ($access != "private" && $access != "public") {
        $access = $phpgw->accounts->array_to_string($access,$n_groups);
     }
     
     if ($url == "http://") {
        $url = "";
     }

     if ($phpgw_info["apps"]["timetrack"]["enabled"]) {
       $sql = "insert into addressbook (ab_owner,ab_access,ab_firstname,ab_lastname,ab_title,ab_email,"
        	. "ab_hphone,ab_wphone,ab_fax,ab_pager,ab_mphone,ab_ophone,ab_street,ab_address2,ab_city,"
            . "ab_state,ab_zip,ab_bday,"
            . "ab_notes,ab_company_id,ab_url) values ('" . $phpgw_info["user"]["account_id"] . "','$access','"
            . addslashes($firstname). "','"
            . addslashes($lastname) . "','"
            . addslashes($title)    . "','"
            . addslashes($email)    . "','" 
            . addslashes($hphone)   . "','"
            . addslashes($wphone)   . "','"
            . addslashes($fax)      . "','"
            . addslashes($pager)    . "','"
            . addslashes($mphone)   . "','"
            . addslashes($ophone)   . "','"
            . addslashes($street)   . "','"
            . addslashes($address2) . "','"
            . addslashes($city) 	. "','"
            . addslashes($state)    . "','"
            . addslashes($zip)      . "','"
            . addslashes($bday) 	. "','"
            . addslashes($notes)    . "','"
            . addslashes($company)  . "','"
            . addslashes($url)      . "')";
     } else {
       $sql = "insert into addressbook (ab_owner,ab_access,ab_firstname,ab_lastname,ab_title,ab_email,"
            . "ab_hphone,ab_wphone,ab_fax,ab_pager,ab_mphone,ab_ophone,ab_street,ab_address2,ab_city,"
            . "ab_state,ab_zip,ab_bday,"
            . "ab_notes,ab_company,ab_url) values ('" . $phpgw_info["user"]["account_id"] . "','$access','"
            . addslashes($firstname). "','"
            . addslashes($lastname) . "','"
            . addslashes($title)    . "','"
            . addslashes($email)    . "','"
            . addslashes($hphone)   . "','"
            . addslashes($wphone)   . "','"
            . addslashes($fax)      . "','"
            . addslashes($pager)    . "','"
            . addslashes($mphone)   . "','"
            . addslashes($ophone)   . "','"
            . addslashes($street)   . "','"
            . addslashes($address2) . "','"
            . addslashes($city)     . "','"
            . addslashes($state)    . "','"
            . addslashes($zip)      . "','"
            . addslashes($bday)     . "','"
            . addslashes($notes)    . "','"
            . addslashes($company)  . "','"
            . addslashes($url)      . "')";
     }
     $phpgw->db->query($sql);
 
     Header("Location: " . $phpgw->link($phpgw_info["server"]["webserver_url"] . "/addressbook/",
            "cd=14"));
  }

  $t->set_var("lang_ok",lang("ok"));
  $t->set_var("lang_clear",lang("clear"));
  $t->set_var("lang_cancel",lang("cancel"));
  $t->set_var("cancel_link",'<a href="'.$phpgw->link($phpgw_info["server"]["webserver_url"] . "/addressbook/") . '">');
  $t->parse("out","add");
  $t->pparse("out","add");

  $phpgw->common->phpgw_footer();
?>
