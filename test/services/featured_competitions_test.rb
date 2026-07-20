require "test_helper"

class FeaturedCompetitionsTest < ActiveSupport::TestCase
  test "sync_missing creates Liga Tica and Liga MX" do
    Competition.where(code: %w[CRC LMX]).delete_all

    FeaturedCompetitions.sync_missing!

    crc = Competition.find_by!(code: "CRC")
    assert_equal "Liga Tica", crc.name
    assert_equal 162, crc.external_id

    lmx = Competition.find_by!(code: "LMX")
    assert_equal "Liga MX", lmx.name
  end

  test "for_api returns featured club codes plus archived WC" do
    api = FeaturedCompetitions.for_api
    codes = api.map { |c| c["code"] || c[:code] }

    assert_includes codes, "CRC"
    assert_includes codes, "LMX"
    assert_includes codes, "WC"
    crc_row = api.find { |c| (c["code"] || c[:code]) == "CRC" }
    assert crc_row["featured"] || crc_row[:featured]
  end
end
