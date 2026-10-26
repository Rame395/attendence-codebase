import { useEffect, useState } from "react";
import axiosInstance from "../../config/ApiClient";
import { toLocalDateInput } from "../nepali-date";
import { fetchHolidayViewer, holidayCoversDate, isHolidayApplicable, type IHolidayLike } from "../holidayScope";

// aaja viewer lai lagne holiday (gender/branch/department scope anusar) -
// check-in button ko satta holiday notice dekhauna
export function useTodayHoliday() {
  const [holiday, setHoliday] = useState<IHolidayLike | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [viewer, holidayRes] = await Promise.all([
          fetchHolidayViewer(),
          axiosInstance.get("/holidays").catch(() => null),
        ]);
        if (!active) return;
        const todayKey = toLocalDateInput(new Date());
        const list = ((holidayRes as unknown as { data?: IHolidayLike[] } | null)?.data || []) as IHolidayLike[];
        setHoliday(list.find((h) => holidayCoversDate(h, todayKey) && isHolidayApplicable(h, viewer)) || null);
      } catch {
        if (active) setHoliday(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { holiday, loading };
}
