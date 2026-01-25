import { AdminTicketList } from '../../components/admin/AdminTicketList';

const CompletedTickets = () => {
    return (
        <AdminTicketList
            title="Completed Tickets"
            initialStatus={['COMPLETED']}
        />
    );
};

export default CompletedTickets;
