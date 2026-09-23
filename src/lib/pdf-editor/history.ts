// Undo / Redo History Stack Manager for PDF Studio

export interface HistoryAction<T> {
  description: string;
  state: T;
  timestamp: number;
}

export class HistoryManager<T> {
  private history: { state: T; description: string; timestamp: number }[] = [];
  private index: number = -1;
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  /**
   * Initializes history with the initial document state.
   */
  public init(initialState: T): void {
    const snapshot = JSON.parse(JSON.stringify(initialState));
    this.history = [{ state: snapshot, description: "Initial State", timestamp: Date.now() }];
    this.index = 0;
  }

  /**
   * Pushes a new state after a user action.
   */
  public pushState(state: T, description: string = "Change"): void {
    const snapshot = JSON.parse(JSON.stringify(state));

    // If we're not at the head of the timeline, discard future redo branch
    if (this.index < this.history.length - 1 && this.index >= 0) {
      this.history = this.history.slice(0, this.index + 1);
    }

    this.history.push({
      description,
      state: snapshot,
      timestamp: Date.now(),
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.index = this.history.length - 1;
    }
  }

  /**
   * Undoes the last action and returns the previous state snapshot.
   */
  public undo(): { state: T; description: string } | null {
    if (this.index <= 0 || this.history.length === 0) return null;
    this.index--;
    const item = this.history[this.index];
    return {
      state: JSON.parse(JSON.stringify(item.state)),
      description: item.description,
    };
  }

  /**
   * Redoes the previously undone action and returns the next state snapshot.
   */
  public redo(): { state: T; description: string } | null {
    if (this.index >= this.history.length - 1 || this.history.length === 0) return null;
    this.index++;
    const item = this.history[this.index];
    return {
      state: JSON.parse(JSON.stringify(item.state)),
      description: item.description,
    };
  }

  public canUndo(): boolean {
    return this.index > 0;
  }

  public canRedo(): boolean {
    return this.index < this.history.length - 1 && this.history.length > 0;
  }

  public clear(): void {
    this.history = [];
    this.index = -1;
  }
}
