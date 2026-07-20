require "test_helper"

class AppFocusTest < ActiveSupport::TestCase
  test "clubs_primary defaults true when APP_FOCUS unset" do
    with_focus(nil) do
      assert AppFocus.clubs_primary?
      assert AppFocus.wc_paused?
    end
  end

  test "wc mode hides clubs primary" do
    with_focus("wc") do
      assert_not AppFocus.clubs_primary?
      assert AppFocus.wc_primary?
      assert_not AppFocus.wc_paused?
    end
  end

  test "league_id_for maps featured codes" do
    assert_equal 162, AppFocus.league_id_for("CRC")
    assert_equal 262, AppFocus.league_id_for("LMX")
  end

  private

  def with_focus(value)
    original = ENV["APP_FOCUS"]
    if value.nil?
      ENV.delete("APP_FOCUS")
    else
      ENV["APP_FOCUS"] = value
    end
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, ENV.fetch("APP_FOCUS", "clubs").freeze)
    yield
  ensure
    if original.nil?
      ENV.delete("APP_FOCUS")
    else
      ENV["APP_FOCUS"] = original
    end
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, ENV.fetch("APP_FOCUS", "clubs").freeze)
  end
end
