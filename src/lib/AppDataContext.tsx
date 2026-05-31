import React, { createContext, useContext, useState, useRef } from "react";

type AppData = {
  profile: any | null;
  role: string | null;
  cases: any[];
  doctors: any[];
  pendingCount: number;
  recentCases: any[];
  stats: {
    active: number;
    lab: number;
    checkup: number;
    totalDoctors: number;
  };
};

const defaultData: AppData = {
  profile: null,
  role: null,
  cases: [],
  doctors: [],
  pendingCount: 0,
  recentCases: [],
  stats: { active: 0, lab: 0, checkup: 0, totalDoctors: 0 },
};

const AppDataContext = createContext<{
  data: AppData;
  setData: (data: Partial<AppData>) => void;
  isPreloaded: boolean;
  setIsPreloaded: (v: boolean) => void;
}>({
  data: defaultData,
  setData: () => {},
  isPreloaded: false,
  setIsPreloaded: () => {},
});

export const AppDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setDataState] = useState<AppData>(defaultData);
  const [isPreloaded, setIsPreloaded] = useState(false);

  const setData = (partial: Partial<AppData>) => {
    setDataState(prev => ({ ...prev, ...partial }));
  };

  return (
    <AppDataContext.Provider value={{ data, setData, isPreloaded, setIsPreloaded }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => useContext(AppDataContext);
