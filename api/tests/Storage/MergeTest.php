<?php

namespace Storage;

use EGroupware\Api;
use EGroupware\Api\LoggedInTest;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../LoggedInTest.php';
require_once __DIR__ . '/TestMerge.php';

class MergeTest extends LoggedInTest
{
	const SIMPLE_TARGET = "{{replacement}}";

	protected function setUp() : void
	{
		$this->merge = new TestMerge();
	}

	/**
	 * Test plain text into a simple text document
	 *
	 */
	#[\PHPUnit\Framework\Attributes\DataProvider('textToTextProvider')]
	public function testTextToText($testText, $expectedText)
	{
		$errors = [];
		$this->merge->setReplacements(['$$replacement$$' => $testText]);
		$result = $this->merge->merge_string(self::SIMPLE_TARGET, [1], $errors, "text/plain");

		$this->assertEmpty($errors, "Errors when merging");
		$this->assertEquals($expectedText, $result);
	}

	public static function textToTextProvider() : array
	{
		return [
			["Plain text", "Plain text"],
			["New\nline text", "New\nline text"],
			['Special -> characters <- & stuff', 'Special -> characters <- & stuff'],
			['<b>Contains HTML</b>', '<b>Contains HTML</b>'],      // HTML is text too
			['HTML<br />newline', "HTML<br />newline"],            // HTML is text too
			["Multi-line:\n1.  First line\n -> Second\n", "Multi-line:\n1.  First line\n -> Second\n"],
		];
	}

	/**
	 * With no parsing into an HTML file, we expect the same
	 */
	#[\PHPUnit\Framework\Attributes\DataProvider('textToHTMLProvider')]
	public function testTextToHtml($testText, $expectedText)
	{
		$this->markTestSkipped("Something goes wrong with GitHub Actions but not locally.  Skipping for now.");
		$errors = [];
		$this->merge->setReplacements(['$$replacement$$' => $testText]);
		$result = $this->merge->merge_string(self::SIMPLE_TARGET, [1], $errors, "text/html");

		$this->assertEmpty($errors, "Errors when merging");
		$this->assertEquals($expectedText, $result);
	}

	public static function textToHtmlProvider() : array
	{
		return [
			["Plain text", "Plain text"],
			["New\nline text", "New<br/>line text"],    // Newlines get parsed anyway
			['Special -> characters <- & stuff', 'Special -> characters '],
			// strip_tags() is not smart.  This could be improved
			['<b>Contains<br /> HTML</b>', '<b>Contains<br/> HTML</b>'],      // Some tags are allowed
			['<q>Contains HTML that will be stripped</q>', 'Contains HTML that will be stripped'],
			["Multi-line:\n1.  First line\n -> Second\n", "Multi-line:<br/>1.  First line<br/> -> Second<br/>"],
		];
	}

	/**
	 * Date placeholders for values that are already formatted by the app
	 *
	 * Every field in $date_fields also gets a $$<field>/date$$ and a $$<field>/time$$ placeholder,
	 * parsed back out of the formatted value in $$<field>$$. That value can be date+time, date-only
	 * or - if the app has no date at all to show - something unparsable, and none of them may abort
	 * the merge: replace() is not called inside a try/catch, so an exception here escapes
	 * merge_string() and kills the whole document.
	 *
	 * Pass criteria: the three placeholders come back as given below and no error is reported. The
	 * date-only cases are the ones that used to throw "Failed to parse time string (24/04/2026)".
	 */
	#[\PHPUnit\Framework\Attributes\DataProvider('dateFieldProvider')]
	public function testDateFields($dateformat, $timeformat, $value, $expected_date, $expected_time)
	{
		$prefs = [Api\DateTime::$user_dateformat, Api\DateTime::$user_timeformat];
		Api\DateTime::$user_dateformat = $dateformat;
		Api\DateTime::$user_timeformat = $timeformat;

		try
		{
			$this->merge->date_fields = ['mydate'];
			$this->merge->setReplacements(['$$mydate$$' => $value]);

			$errors = [];
			$result = $this->merge->merge_string('{{mydate}}|{{mydate/date}}|{{mydate/time}}', [1], $errors, 'text/plain');

			$this->assertEmpty($errors, "Errors when merging '$value'");
			$this->assertEquals("$value|$expected_date|$expected_time", $result, "Wrong date placeholders for '$value'");
		}
		finally
		{
			[Api\DateTime::$user_dateformat, Api\DateTime::$user_timeformat] = $prefs;
		}
	}

	public static function dateFieldProvider() : array
	{
		return [
			// value in the user's format, date-only: used to throw, as the combined parse format
			// needs a time part and PHP then reads "24/04/2026" as m/d/Y
			'date only, d/m/Y'   => ['d/m/Y', 'H:i', '24/04/2026', '24/04/2026', '00:00'],
			'date + time, d/m/Y' => ['d/m/Y', 'H:i', '24/04/2026 10:30', '24/04/2026', '10:30'],
			'date only, d.m.Y'   => ['d.m.Y', 'H:i', '24.04.2026', '24.04.2026', '00:00'],
			'date only, m/d/Y'   => ['m/d/Y', 'h:i a', '04/24/2026', '04/24/2026', '12:00 am'],
			// other shapes an app can produce, all of them worked before and must keep working
			'iso date'           => ['d/m/Y', 'H:i', '2026-04-24', '24/04/2026', '00:00'],
			'db timestamp'       => ['d/m/Y', 'H:i', '2026-04-24 10:30:00', '24/04/2026', '10:30'],
			'seconds'            => ['d/m/Y', 'H:i', '24/04/2026 10:30:15', '24/04/2026', '10:30'],
			// no date to show: keep the value instead of aborting the merge
			'unparsable'         => ['d/m/Y', 'H:i', 'n/a', 'n/a', ''],
		];
	}
}
