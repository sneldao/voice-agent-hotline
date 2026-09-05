export type DeskStudyStage = 'arrival' | 'conversation' | 'confirmation';
export type DeskStudySide = 'buy' | 'sell';

export interface DeskStudyState {
  stage: DeskStudyStage;
  side: DeskStudySide;
  quantity: string;
  acknowledged: boolean;
}

export type DeskStudyAction =
  | { type: 'stage'; stage: DeskStudyStage }
  | { type: 'side'; side: DeskStudySide }
  | { type: 'quantity'; quantity: string }
  | { type: 'acknowledge' }
  | { type: 'reset' };

export const initialDeskStudy: DeskStudyState = {
  stage: 'arrival',
  side: 'buy',
  quantity: '10',
  acknowledged: false,
};

export function isStudyQuantityValid(quantity: string): boolean {
  return /^[1-9]\d{0,3}$/.test(quantity) && Number(quantity) <= 1000;
}

export function isDeskStudyPath(pathname: string | null): boolean {
  return pathname === '/desk-study' || pathname === '/desk-study/';
}

export function deskStudyReducer(state: DeskStudyState, action: DeskStudyAction): DeskStudyState {
  switch (action.type) {
    case 'stage':
      return { ...state, stage: action.stage, acknowledged: false };
    case 'side':
      return { ...state, side: action.side, acknowledged: false };
    case 'quantity':
      return { ...state, quantity: action.quantity, acknowledged: false };
    case 'acknowledge':
      return state.stage === 'confirmation' && isStudyQuantityValid(state.quantity)
        ? { ...state, acknowledged: true }
        : state;
    case 'reset':
      return { ...initialDeskStudy };
  }
}
