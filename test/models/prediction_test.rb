require "test_helper"

class PredictionTest < ActiveSupport::TestCase
  setup { @pred = Prediction.create!(match_external_id: "m-1") }

  test "vote! records a vote and computes percentages" do
    result = @pred.vote!("home", "token-a")
    assert_equal 1, result[:home_votes]
    assert_equal 100, result[:home_pct]
    assert_equal 1, result[:total]
  end

  test "vote! rejects an unknown choice" do
    assert_equal({ error: "invalid_choice" }, @pred.vote!("maybe", "token-a"))
    assert_equal 0, @pred.reload.home_votes + @pred.draw_votes + @pred.away_votes
  end

  test "vote! prevents the same token voting twice" do
    @pred.vote!("home", "token-a")
    assert_equal({ error: "already_voted" }, @pred.vote!("away", "token-a"))
    assert_equal 1, @pred.reload.home_votes
    assert_equal 0, @pred.away_votes
  end

  test "percentages reflect the split across choices" do
    @pred.vote!("home", "t1")
    @pred.vote!("home", "t2")
    @pred.vote!("away", "t3")
    @pred.vote!("draw", "t4")
    r = @pred.as_json_result
    assert_equal 4, r[:total]
    assert_equal 50, r[:home_pct]
    assert_equal 25, r[:away_pct]
    assert_equal 25, r[:draw_pct]
  end
end
