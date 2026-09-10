<?php
/**
 * EGroupware Admin: the container-filter of the group-list
 *
 * @link http://www.egroupware.org
 * @package admin
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License Version 2+
 */

namespace EGroupware\Admin;

use EGroupware\Api;

require_once realpath(__DIR__ . '/../../api/tests/LoggedInTest.php');

/**
 * admin_ui::get_groups() filters on a container the groups do not carry
 *
 * The container is not a column of anything: Api\Accounts::container() derives it per group by
 * running $GLOBALS['egw_info']['server']['group_container_regexp'] over the attribute named by
 * ...['group_container_attribute']. accounts->search() therefore cannot filter on it, and
 * get_groups() has to fetch every group, filter here and do its own paging - which is the part
 * that can silently go wrong (a total that still counts the unfiltered set leaves the nextmatch
 * asking for pages that do not exist).
 *
 * The instance under test has no container configured (container() returns NULL for every group,
 * the list shows "None"), so every test that needs real container names configures one for the
 * duration of the test only, in $GLOBALS - no config row is written.
 *
 * Read-only: nothing here creates, changes or deletes an account.
 */
class GroupContainerFilterTest extends \EGroupware\Api\LoggedInTest
{
	/**
	 * Group-container config as we found it, restored in tearDown()
	 *
	 * @var array
	 */
	private $saved_config = [];

	public static function setUpBeforeClass() : void
	{
		// doc/phpunit.xml hardcodes EGW_USER=demo, which does not exist on this instance - the
		// env vars only reach load_egw() when copied into $GLOBALS first
		foreach(['EGW_USER', 'EGW_PASSWORD', 'EGW_DOMAIN'] as $var)
		{
			if(($value = getenv($var)) !== false && $value !== '')
			{
				$GLOBALS[$var] = $value;
			}
		}
		parent::setUpBeforeClass();
	}

	protected function setUp() : void
	{
		foreach(['group_container_attribute', 'group_container_regexp', 'group_container_replace'] as $name)
		{
			$this->saved_config[$name] = $GLOBALS['egw_info']['server'][$name] ?? null;
		}
	}

	protected function tearDown() : void
	{
		foreach($this->saved_config as $name => $value)
		{
			if (isset($value))
			{
				$GLOBALS['egw_info']['server'][$name] = $value;
			}
			else
			{
				unset($GLOBALS['egw_info']['server'][$name]);
			}
		}
	}

	/**
	 * Make every group carry a container: the first letter of its account_lid, upper-cased
	 *
	 * Accounts::container() ucfirst()s the match, so the container of "whiteraven" is "W".
	 */
	private function configureContainerByFirstLetter() : void
	{
		$GLOBALS['egw_info']['server']['group_container_attribute'] = 'account_lid';
		$GLOBALS['egw_info']['server']['group_container_regexp']    = '/^(.)/';
		$GLOBALS['egw_info']['server']['group_container_replace']   = '$1';
	}

	/**
	 * Call get_groups() the way the nextmatch does, without the "is_huge" marker in the result
	 *
	 * @param array $query
	 * @return array [$total, $rows]
	 */
	private function getGroups(array $query) : array
	{
		$query += ['start' => 0, 'num_rows' => 0, 'search' => null, 'order' => 'account_lid', 'sort' => 'ASC'];
		$rows = null;
		$total = \admin_ui::get_groups($query, $rows);
		unset($rows['is_huge']);

		return [$total, array_values($rows)];
	}

	public function testNoFilterReturnsEveryGroup()
	{
		[$total, $rows] = $this->getGroups([]);

		$this->assertGreaterThan(0, $total, 'the instance has no groups at all - nothing to test against');
		$this->assertCount($total, $rows, 'the unfiltered list must return as many rows as it reports');
	}

	/**
	 * With no container configured every group is "without container", so that filter is a no-op
	 * and any named container matches nothing.
	 */
	public function testWithoutContainerMatchesEveryGroupWhenNoneIsConfigured()
	{
		unset($GLOBALS['egw_info']['server']['group_container_attribute']);

		[$unfiltered] = $this->getGroups([]);
		[$total, $rows] = $this->getGroups(['col_filter' => ['container' => \admin_ui::NO_CONTAINER]]);

		$this->assertSame($unfiltered, $total);
		$this->assertCount($total, $rows);

		[$named_total] = $this->getGroups(['col_filter' => ['container' => 'Whatever']]);
		$this->assertSame(0, $named_total);
	}

	public function testFilterOnANamedContainerReturnsOnlyItsGroups()
	{
		$this->configureContainerByFirstLetter();

		[$unfiltered, $all_rows] = $this->getGroups([]);
		$container = Api\Accounts::container($all_rows[0]);
		$this->assertNotNull($container, 'the test config must give every group a container');

		[$total, $rows] = $this->getGroups(['col_filter' => ['container' => $container]]);

		$this->assertGreaterThan(0, $total);
		$this->assertLessThan($unfiltered, $total, 'a single first letter cannot match every group');
		$this->assertCount($total, $rows, 'the reported total must match the rows actually returned');
		foreach($rows as $row)
		{
			$this->assertSame($container, $row['container'], "{$row['account_lid']} is not in container $container");
		}
	}

	/**
	 * The filtered total is what the nextmatch pages against, so it must count the filtered set -
	 * not the one accounts->search() reported.
	 */
	public function testFilteredTotalCountsTheFilteredSet()
	{
		$this->configureContainerByFirstLetter();

		[$unfiltered, $all_rows] = $this->getGroups([]);
		$container = Api\Accounts::container($all_rows[0]);

		$expected = count(array_filter($all_rows, static function(array $group) use ($container)
		{
			return Api\Accounts::container($group) === $container;
		}));

		[$total] = $this->getGroups(['col_filter' => ['container' => $container]]);

		$this->assertSame($expected, $total);
		$this->assertNotSame($unfiltered, $total);
	}

	/**
	 * Paging happens after filtering, so page 2 of a filtered list must not repeat page 1.
	 */
	public function testFilteredResultIsPagedAfterFiltering()
	{
		$this->configureContainerByFirstLetter();

		// pick the container with the most groups, so there is something to page through
		[, $all_rows] = $this->getGroups([]);
		$counts = [];
		foreach($all_rows as $group)
		{
			$counts[Api\Accounts::container($group)] = ($counts[Api\Accounts::container($group)] ?? 0) + 1;
		}
		arsort($counts);
		$container = key($counts);
		$this->assertGreaterThan(2, current($counts), 'no container has enough groups to page through');

		[$total, $page1] = $this->getGroups(['col_filter' => ['container' => $container], 'start' => 0, 'num_rows' => 2]);
		[, $page2] = $this->getGroups(['col_filter' => ['container' => $container], 'start' => 2, 'num_rows' => 2]);

		$this->assertSame(current($counts), $total, 'the total must stay the full filtered count while paging');
		$this->assertCount(2, $page1);
		$this->assertNotEmpty($page2);
		$this->assertEmpty(
			array_intersect(array_column($page1, 'account_id'), array_column($page2, 'account_id')),
			'page 2 repeats groups from page 1'
		);
		foreach(array_merge($page1, $page2) as $row)
		{
			$this->assertSame($container, $row['container']);
		}
	}

	/**
	 * group_containers() feeds the filter's option list, so it must offer exactly the containers
	 * that actually occur - and nothing when none is configured.
	 */
	public function testGroupContainersListsTheContainersThatOccur()
	{
		$ref = new \ReflectionMethod(\admin_ui::class, 'group_containers');
		$ref->setAccessible(true);

		unset($GLOBALS['egw_info']['server']['group_container_attribute']);
		$this->assertSame([], $ref->invoke(null), 'no container configured must offer no container to filter on');

		$this->configureContainerByFirstLetter();
		[, $all_rows] = $this->getGroups([]);
		$expected = array_unique(array_map([Api\Accounts::class, 'container'], $all_rows));
		natcasesort($expected);

		$this->assertSame(array_values($expected), $ref->invoke(null));
	}
}
