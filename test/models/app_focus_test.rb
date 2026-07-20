require "test_helper"

class AppFocusTest < ActiveSupport::TestCase
  test "defaults to clubs focus" do
    assert_equal "clubs", AppFocus::FOCUS
    assert AppFocus.clubs_primary?
    assert AppFocus.wc_paused?
    refute AppFocus.wc_primary?
  end

  test "league_id_for maps competition codes" do
    assert_equal 39, AppFocus.league_id_for("PL")
    assert_equal 2, AppFocus.league_id_for("UCL")
    assert_nil AppFocus.league_id_for("UNKNOWN")
  end
end
