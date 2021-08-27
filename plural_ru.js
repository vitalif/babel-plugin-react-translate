export default function plural_ru(count, one, few, many)
{
    var sto = count % 100;
    var r;
    if (sto >= 10 && sto <= 20)
        r = many;
    else
    {
        switch (count % 10)
        {
            case 1: r = one; break;
            case 2:
            case 3:
            case 4: r = few; break;
            default: r = many; break;
        }
    }
    return r.replace('%d', count);
}
