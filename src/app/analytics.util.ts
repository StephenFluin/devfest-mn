declare global {
    interface Window {
        gtag: any;
    }
}
export const trackTicketPurchase = function (orderData: any) {
    window.gtag('event', 'purchase', {
        transaction_id: orderData.orderId,
        value: 25.0,
        currency: 'USD',
        event_label: 'Ticket Sale',
    });
};
