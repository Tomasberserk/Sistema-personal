import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useWidgetFinanzas,
  useWidgetHabitos,
  useWidgetMoto,
} from '../api/customApi';
import {
  syncFinanzasWidget,
  syncHabitosWidget,
  syncMotoWidget,
} from '../services/widgetsSync';

/**
 * Hook centralizado que sincroniza periódicamente los datos de los widgets
 * nativos de Android cuando el usuario está autenticado.
 */
export function useJarvisWidgetsSync() {
  const { user } = useAuth();
  const isAuth = Boolean(user);
  const today = new Date().toISOString().slice(0, 10);

  const finanzasQuery = useWidgetFinanzas(isAuth);
  const habitosQuery = useWidgetHabitos(today, 6, isAuth);
  const motoQuery = useWidgetMoto(isAuth);

  // Sincronizar widget de Finanzas
  useEffect(() => {
    if (finanzasQuery.data && isAuth) {
      void syncFinanzasWidget(finanzasQuery.data);
    }
  }, [finanzasQuery.data, isAuth]);

  // Sincronizar widget de Hábitos
  useEffect(() => {
    if (habitosQuery.data && isAuth) {
      void syncHabitosWidget(habitosQuery.data);
    }
  }, [habitosQuery.data, isAuth]);

  // Sincronizar widget de Moto
  useEffect(() => {
    if (motoQuery.data && isAuth) {
      void syncMotoWidget(motoQuery.data);
    }
  }, [motoQuery.data, isAuth]);
}
