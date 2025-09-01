import type { Graph } from "../Graph";
import type { UIManager } from "./UIManager";

export enum NotificationLevel {
    Success = "success",
    Warning = "warning",
    Danger = "danger",
    Info = "info",
}

export interface Notification {
    level: NotificationLevel;
    title: string;
    message?: string;
}

export class Notifier {
    public graph: Graph
    public UIManager: UIManager

    constructor(graph: Graph) {
        this.graph = graph
        this.UIManager = this.graph.UIManager
    }

    /**
     * Dispatch a notification to the UIManager.
     * 
     * @param level - The severity level of the notification.
     * @param title - The title to display in the notification.
     * @param message - Optional detailed message for the notification.
     */
    public notify(level: NotificationLevel, title: string, message?: string): void {
        const notification: Notification = { level, title, message };
        this.UIManager.showNotification(notification);
    }

    public success(title: string, message?: string): void {
        this.notify(NotificationLevel.Success, title, message);
    }

    public warning(title: string, message?: string): void {
        this.notify(NotificationLevel.Warning, title, message);
    }

    public error(title: string, message?: string): void {
        this.notify(NotificationLevel.Danger, title, message);
    }

    public info(title: string, message?: string): void {
        this.notify(NotificationLevel.Info, title, message);
    }
}