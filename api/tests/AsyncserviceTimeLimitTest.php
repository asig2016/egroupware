<?php
/**
 * Asyncservice::liftTimeLimit() - the execution limit the async jobs run under
 *
 * BEHAVIOUR UNDER TEST
 * check_run() lifts PHP's execution limit before it runs the due jobs. It used to do that with a
 * plain set_time_limit(0), which is a no-op in a FastCGI pool whose max_execution_time is already
 * 0: PHP arms a CPU timer of max_input_time at request start, zend_set_timeout(0) skips
 * setitimer(), and zend_unset_timeout() only disarms when the recorded limit is non-zero - so the
 * input timer fires after 60 CPU seconds, as "Maximum execution time of 0 seconds exceeded".
 * liftTimeLimit() arms a real limit first and then lifts it, which disarms whatever is pending.
 *
 * PASS CRITERIA
 * - after liftTimeLimit() the limit reads 0, whatever it was before (0, or a positive limit)
 * - the method is harmless when called twice in a row
 * The timer itself cannot be observed from PHPUnit (the CLI arms no input timer, and PHPUnit
 * cannot run inside an FPM pool); the pool-level check is the probe described in the method's
 * doc comment: a CPU loop in the async pool dies at exactly max_input_time CPU seconds without
 * the method and survives with it (2026-10-23, PHP 8.5.12 NTS).
 *
 * ENVIRONMENT
 * No database, no session.
 *
 * @package api
 * @subpackage tests
 */

namespace EGroupware\Api;

use PHPUnit\Framework\TestCase;

class AsyncserviceTimeLimitTest extends TestCase
{
	private string $limit = '0';

	protected function setUp(): void
	{
		$this->limit = (string)ini_get('max_execution_time');
	}

	protected function tearDown(): void
	{
		@set_time_limit((int)$this->limit);
	}

	public function testLiftsAnExistingLimit()
	{
		set_time_limit(300);
		$this->assertSame('300', ini_get('max_execution_time'));

		Asyncservice::liftTimeLimit();

		$this->assertSame('0', ini_get('max_execution_time'));
	}

	public function testLiftsWhenTheLimitIsAlreadyZero()
	{
		set_time_limit(0);
		$this->assertSame('0', ini_get('max_execution_time'));

		Asyncservice::liftTimeLimit();
		Asyncservice::liftTimeLimit();

		$this->assertSame('0', ini_get('max_execution_time'));
	}
}
