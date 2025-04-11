import { createStyles } from '@material-ui/core/styles';

const cardBodyStyle = createStyles({
  cardBody: {
    padding: '0.9375rem 20px',
    flex: '1 1 auto',
    WebkitBoxFlex: 1,
    position: 'relative' as const,
  },
  cardBodyPlain: {
    paddingLeft: '5px',
    paddingRight: '5px',
  },
  cardBodyProfile: {
    marginTop: '15px',
  },
});

export default cardBodyStyle;
