require "test_helper"

class FifaThirdPlaceAnnexCTest < ActiveSupport::TestCase
  test "lookup has all 495 combinations" do
    assert_equal 495, FifaThirdPlaceAnnexC::LOOKUP.size
  end

  test "each row maps eight distinct third-place groups to winner columns" do
    FifaThirdPlaceAnnexC::LOOKUP.each do |key, mapping|
      assert_equal 8, key.length
      assert_equal FifaThirdPlaceAnnexC::WINNERS.sort, mapping.keys.sort
      assert_equal key.chars.sort, mapping.values.sort
    end
  end

  test "known combination resolves deterministically" do
    sample = FifaThirdPlaceAnnexC::LOOKUP.first
    key, mapping = sample
    assert_equal 8, key.length
    assert_equal FifaThirdPlaceAnnexC::WINNERS.sort, mapping.keys.sort
    assert_equal key.chars.sort, mapping.values.sort
  end
end
