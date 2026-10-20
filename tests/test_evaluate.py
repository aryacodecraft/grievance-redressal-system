from backend.evaluate import class_error_counts


def test_class_error_counts_reports_water_false_positive_and_miss():
    truth = ["Water", "Road", "Water", "Sanitation"]
    predictions = ["Water", "Water", "Road", "Sanitation"]

    assert class_error_counts(truth, predictions, "Water") == (1, 1, 1)
