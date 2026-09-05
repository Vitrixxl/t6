"""Tests d'ingestion : archives miniatures écrites dans le test, sans réseau."""
import io
import unittest
import zipfile
from gtfs_timetable import build


def archive(overrides=None):
    files = {
        "agency.txt": "agency_id,agency_name,agency_url,agency_timezone\nT,TCL,https://example.test,Europe/Paris\n",
        "routes.txt": "route_id,route_short_name,route_long_name,route_type\nT,T1,Test,0\n",
        "stops.txt": "stop_id,stop_name,stop_lat,stop_lon,parent_station,wheelchair_boarding\nA,Quai,45.75,4.8,P,1\nB,Quai,45.75,4.81,P,1\nC,Arrivée,45.75,4.82,,1\n",
        "trips.txt": "route_id,service_id,trip_id,shape_id,trip_headsign,wheelchair_accessible\nT,S,course,trace,Arrivée,1\n",
        "stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence\ncourse,08:10:00,08:10:00,A,1\ncourse,08:15:00,08:15:00,B,2\ncourse,08:20:00,08:20:00,C,3\n",
        "shapes.txt": "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\ntrace,45.75,4.8,1\ntrace,45.75,4.81,2\ntrace,45.75,4.82,3\n",
        "calendar.txt": "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nS,1,1,1,1,1,1,0,20260905,20260907\n",
    }
    files.update(overrides or {})
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as target:
        for name, content in files.items():
            target.writestr(name, content)
    data.seek(0)
    return zipfile.ZipFile(data)


class TimetableImportTests(unittest.TestCase):
    def test_preserves_quays_and_passage_order(self):
        with archive() as source:
            data = build(source, "test")
        self.assertEqual(len(data["network"]["stops"]), 3)
        self.assertEqual([p["shapeIndex"] for p in data["trips"][0]["passages"]], [0, 1, 2])
        self.assertEqual(data["trips"][0]["passages"][0]["departure"], 29400)

    def test_calendar_exceptions(self):
        with archive({"calendar_dates.txt": "service_id,date,exception_type\nS,20260905,2\nS,20260906,1\n"}) as source:
            data = build(source, "test")
        self.assertEqual([row["date"] for row in data["services"]], ["2026-09-06", "2026-09-07"])

    def test_missing_shape_is_not_invented(self):
        with archive({"shapes.txt": "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n"}) as source:
            with self.assertRaisesRegex(ValueError, "tracé GTFS absent"):
                build(source, "test")

    def test_frequencies_remain_identified(self):
        with archive({"frequencies.txt": "trip_id,start_time,end_time,headway_secs,exact_times\ncourse,08:00:00,10:00:00,600,0\n"}) as source:
            data = build(source, "test")
        self.assertFalse(data["trips"][0]["frequency"]["exact"])
        self.assertEqual(data["metadata"]["maxTimeSeconds"], 36600)

    def test_parent_transfer_is_expanded_to_quays(self):
        with archive({"transfers.txt": "from_stop_id,to_stop_id,transfer_type,min_transfer_time\nP,C,2,120\n"}) as source:
            data = build(source, "test")
        self.assertEqual([(t["fromStopId"], t["toStopId"]) for t in data["transfers"]], [("A", "C"), ("B", "C")])
        self.assertTrue(all(not t["estimated"] for t in data["transfers"]))

    def test_no_interpolation_of_missing_times(self):
        with archive({"stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence\ncourse,,,A,1\ncourse,08:20:00,08:20:00,C,2\n"}) as source:
            with self.assertRaisesRegex(ValueError, "sans heure"):
                build(source, "test")


if __name__ == "__main__":
    unittest.main()
